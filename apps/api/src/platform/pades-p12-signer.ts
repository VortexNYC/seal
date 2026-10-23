/**
 * Platform PAdES-B-B CMS signer (SEA-49 Level 1b).
 *
 * Same flow as @signpdf/signer-p12, plus ESS signing-certificate-v2
 * (ETSI EN 319 122 / CAdES-B-B mandatory authenticated attribute).
 */

import forgeImport from "node-forge";
import { Signer, SignPdfError, convertBuffer } from "@signpdf/utils";

// node-forge's published types lag the runtime API we need (createBuffer args,
// pkcs7 authenticatedAttributes value shapes). Narrow at the boundary.
// Do NOT use createRequire — Workers deploy rejects import.meta.url as undefined.
const forge = forgeImport as unknown as ForgeRuntime;

type ForgeAsn1 = { tagClass: number; type: number; constructed: boolean; value: unknown };

type ForgeRuntime = {
  util: {
    createBuffer: (input?: string, encoding?: string) => { getBytes?: () => string };
  };
  asn1: {
    Class: { UNIVERSAL: number };
    Type: { SEQUENCE: number; OCTETSTRING: number };
    create: (
      tagClass: number,
      type: number,
      constructed: boolean,
      value: unknown
    ) => ForgeAsn1;
    fromDer: (bytes: unknown) => unknown;
    toDer: (asn1: unknown) => { getBytes: () => string };
  };
  md: { sha256: { create: () => { update: (s: string) => void; digest: () => { getBytes: () => string } } } };
  pki: {
    oids: Record<string, string>;
    certificateToAsn1: (cert: ForgeCert) => unknown;
  };
  pkcs12: {
    pkcs12FromAsn1: (
      asn1: unknown,
      strict: boolean,
      passphrase: string
    ) => {
      getBags: (opts: { bagType: string }) => Record<string, ForgeBag[] | undefined>;
    };
  };
  pkcs7: {
    createSignedData: () => {
      content: unknown;
      addCertificate: (cert: ForgeCert) => void;
      addSigner: (opts: {
        key: ForgeKey;
        certificate: ForgeCert;
        digestAlgorithm: string;
        authenticatedAttributes: Array<{ type: string; value?: unknown }>;
      }) => void;
      sign: (opts: { detached: boolean }) => void;
      toAsn1: () => unknown;
    };
  };
};

type ForgeKey = {
  n: { compareTo: (other: unknown) => number };
  e: { compareTo: (other: unknown) => number };
};

type ForgeCert = {
  publicKey: ForgeKey;
};

type ForgeBag = {
  cert?: ForgeCert;
  key?: ForgeKey;
};

/** Workers Buffer typings omit the legacy "binary" encoding — latin1 is the same bytes. */
function toBinaryString(buf: Uint8Array): string {
  let out = "";
  for (let i = 0; i < buf.byteLength; i++) {
    out += String.fromCharCode(buf[i]!);
  }
  return out;
}

/** id-aa-signingCertificateV2 (RFC 5035) */
const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47";

export type PadesP12SignerOptions = {
  passphrase?: string;
  asn1StrictParsing?: boolean;
};

/** Build SigningCertificateV2 ASN.1 (SHA-256 certHash; hashAlgorithm omitted = DEFAULT). */
export function buildSigningCertificateV2Asn1(cert: ForgeCert): ForgeAsn1 {
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(certDer);
  const certHash = md.digest().getBytes();

  const essCertId = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OCTETSTRING,
        false,
        certHash
      ),
    ]
  );

  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [essCertId]
      ),
    ]
  );
}

/**
 * PKCS#12 → detached CMS with CAdES-B-B authenticated attributes:
 * contentType, signingTime, messageDigest, signing-certificate-v2.
 */
export class PadesP12Signer extends Signer {
  private readonly passphrase: string;
  private readonly asn1StrictParsing: boolean;
  private readonly certBytes: string;

  constructor(
    p12Buffer: Buffer | Uint8Array | string,
    additionalOptions: PadesP12SignerOptions = {}
  ) {
    super();
    const buffer = convertBuffer(p12Buffer, "p12 certificate");
    this.passphrase = additionalOptions.passphrase ?? "";
    this.asn1StrictParsing = additionalOptions.asn1StrictParsing ?? false;
    this.certBytes = toBinaryString(buffer);
  }

  override async sign(
    pdfBuffer: Buffer,
    signingTime: Date | undefined = undefined
  ): Promise<Buffer> {
    if (!(pdfBuffer instanceof Buffer)) {
      throw new SignPdfError(
        "PDF expected as Buffer.",
        SignPdfError.TYPE_INPUT
      );
    }

    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(this.certBytes));
    const p12 = forge.pkcs12.pkcs12FromAsn1(
      p12Asn1,
      this.asn1StrictParsing,
      this.passphrase
    );

    const certBagOid = forge.pki.oids.certBag;
    const keyBagOid = forge.pki.oids.pkcs8ShroudedKeyBag;
    if (!certBagOid || !keyBagOid) {
      throw new SignPdfError(
        "node-forge OID table missing cert/key bag types.",
        SignPdfError.TYPE_INPUT
      );
    }

    const certBags = p12.getBags({ bagType: certBagOid })[certBagOid] ?? [];
    const keyBags = p12.getBags({ bagType: keyBagOid })[keyBagOid] ?? [];
    const privateKey = keyBags[0]?.key;
    if (!privateKey) {
      throw new SignPdfError(
        "PKCS#12 has no private key.",
        SignPdfError.TYPE_INPUT
      );
    }

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(toBinaryString(pdfBuffer));

    let certificate: ForgeCert | undefined;
    for (const bag of certBags) {
      const cert = bag.cert;
      if (!cert) continue;
      p7.addCertificate(cert);
      if (
        privateKey.n.compareTo(cert.publicKey.n) === 0 &&
        privateKey.e.compareTo(cert.publicKey.e) === 0
      ) {
        certificate = cert;
      }
    }

    if (!certificate) {
      throw new SignPdfError(
        "Failed to find a certificate that matches the private key.",
        SignPdfError.TYPE_INPUT
      );
    }

    const sha256Oid = forge.pki.oids.sha256;
    const contentTypeOid = forge.pki.oids.contentType;
    const dataOid = forge.pki.oids.data;
    const signingTimeOid = forge.pki.oids.signingTime;
    const messageDigestOid = forge.pki.oids.messageDigest;
    if (
      !sha256Oid ||
      !contentTypeOid ||
      !dataOid ||
      !signingTimeOid ||
      !messageDigestOid
    ) {
      throw new SignPdfError(
        "node-forge OID table incomplete.",
        SignPdfError.TYPE_INPUT
      );
    }

    p7.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: sha256Oid,
      authenticatedAttributes: [
        { type: contentTypeOid, value: dataOid },
        { type: signingTimeOid, value: signingTime ?? new Date() },
        { type: messageDigestOid },
        {
          type: OID_SIGNING_CERTIFICATE_V2,
          value: buildSigningCertificateV2Asn1(certificate),
        },
      ],
    });

    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  }
}
