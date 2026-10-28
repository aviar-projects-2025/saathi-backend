import { S3Client } from "@aws-sdk/client-s3";

const { AWS_REGION, AWS_S3_BUCKET } = process.env;

if (!AWS_REGION || !AWS_S3_BUCKET) {
  throw new Error(
    "AWS_REGION and AWS_S3_BUCKET must be configured"
  );
}

export const s3 = new S3Client({
  region: AWS_REGION
});

export const S3_BUCKET = AWS_S3_BUCKET;