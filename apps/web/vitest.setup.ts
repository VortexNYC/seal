import "@testing-library/jest-dom/vitest";

// Polyfill Blob.text() for jsdom (not available in jsdom 26.1.0)
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
