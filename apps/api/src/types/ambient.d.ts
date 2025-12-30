// Minimal ambient module declarations to satisfy TypeScript in strict mode
// for runtime-only dependencies without @types packages installed.

declare module 'multer' {
  const multer: any;
  export default multer;
}

declare module 'form-data' {
  const FormData: any;
  export default FormData;
}

declare module 'key-did-provider-ed25519' {
  export const Ed25519Provider: any;
}

declare module 'key-did-resolver' {
  export function getResolver(...args: any[]): any;
}

declare module 'helmet' {
  const helmet: any;
  export default helmet;
}

declare module 'express-rate-limit' {
  const rateLimit: any;
  export default rateLimit;
}

// Augment Express Request for multer .file support used in upload endpoint
declare namespace Express {
  export interface Request {
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    };
  }
}

