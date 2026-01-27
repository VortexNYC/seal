/// <reference types="vite/client" />

declare module 'fumadocs-mdx:collections/server' {
	import type { InferPageType } from 'fumadocs-core/source';
	import type { DocData, DocMethods } from 'fumadocs-mdx/runtime/types';

	export const docs: {
		toFumadocsSource(): any;
	};
}
