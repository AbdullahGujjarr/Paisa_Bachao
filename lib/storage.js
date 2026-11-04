import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { EXT } from './sniff';

export const cloudinaryEnabled = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
export const UPLOAD_DIR = path.join(process.cwd(), '.uploads');

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** A signed link to a stored PDF that stops working after five minutes. */
export function signedPdfUrl(publicId) {
  configure();
  return cloudinary.utils.private_download_url(publicId, 'pdf', {
    resource_type: 'image',
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}

/** Stores a validated file in Cloudinary, or on local disk when Cloudinary is not configured. */
export async function storeFile(buffer, { mime, folder = 'paisabachao' }) {
  if (cloudinaryEnabled) {
    configure();
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder, resource_type: 'auto' }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(buffer);
    });
    // Cloudinary blocks public PDF links by default, so PDFs are served through a signed route.
    if (mime === 'application/pdf') return `/api/cloud-file?id=${encodeURIComponent(result.public_id)}`;
    return result.secure_url;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${EXT[mime]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/api/files/${name}`;
}
