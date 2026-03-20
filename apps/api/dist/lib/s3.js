import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
function createS3Client() {
    const endpoint = process.env.TIMEWEB_S3_ENDPOINT ?? "https://s3.timeweb.cloud";
    const region = process.env.TIMEWEB_S3_REGION ?? "ru-1";
    return new S3Client({
        endpoint,
        region,
        credentials: {
            accessKeyId: process.env.TIMEWEB_S3_ACCESS_KEY ?? "",
            secretAccessKey: process.env.TIMEWEB_S3_SECRET_KEY ?? "",
        },
        forcePathStyle: false,
    });
}
export function isS3Configured() {
    return !!(process.env.TIMEWEB_S3_ACCESS_KEY &&
        process.env.TIMEWEB_S3_SECRET_KEY &&
        process.env.TIMEWEB_S3_BUCKET);
}
// Upload buffer to S3, returns public URL
export async function uploadToS3(buffer, key, contentType) {
    const client = createS3Client();
    const bucket = process.env.TIMEWEB_S3_BUCKET;
    const upload = new Upload({
        client,
        params: {
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: "public-read",
        },
    });
    await upload.done();
    const endpoint = process.env.TIMEWEB_S3_ENDPOINT ?? "https://s3.timeweb.cloud";
    // Timeweb S3 virtual-hosted URL: https://{bucket}.s3.timeweb.cloud/{key}
    const host = new URL(endpoint).host;
    return `https://${bucket}.${host}/${key}`;
}
// Delete object from S3 by key
export async function deleteFromS3(key) {
    const client = createS3Client();
    const bucket = process.env.TIMEWEB_S3_BUCKET;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
