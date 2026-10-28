
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "../../config/s3.js";
import { getRegistrationSession } from "../../config/registrationSession.js";

const ALLOWED_FOLDERS = new Set([
  "profiles",
  "community"
]);

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function getAuthenticatedUserId(req) {
  const user = req.user;

  return String(
    user?._id || user?.id || req.userId || req.user?.userId || req.userId || ""
  );
}

export const createUploadUrl = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { folder, contentType } = req.body || {};

    if (!userId || userId === "undefined") {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder"
      });
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG and WebP images are allowed"
      });
    }

    const key =
      `${folder}/${userId}/${randomUUID()}.` +
      EXTENSIONS[contentType];

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300
    });

    return res.json({
      success: true,
      data: {
        key,
        uploadUrl,
        contentType,
        expiresIn: 300
      }
    });
  } catch (error) {
    console.error("Create S3 upload URL failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create upload URL"
    });
  }
};

export const createViewUrl = async (req, res) => {
  try {
    const { key } = req.body || {};

    if (typeof key !== "string" || !key.trim()) {
      return res.status(400).json({
        success: false,
        message: "Image key is required"
      });
    }

    // IMPORTANT:
    // Before enabling this endpoint, authorize access to the image
    // using your User/Post database records. Authentication alone
    // is not sufficient to authorize arbitrary private objects.

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    });

    const viewUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600
    });

    return res.json({
      success: true,
      data: { viewUrl, expiresIn: 3600 }
    });
  } catch (error) {
    console.error("Create S3 view URL failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create image view URL"
    });
  }
};


export const createRegistrationUploadUrl = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Registration credential required",
      });
    }

    const registration = await getRegistrationSession(match[1]);

    if (!registration) {
      return res.status(401).json({
        success: false,
        message: "Registration session is invalid or expired",
      });
    }

    const { contentType } = req.body || {};

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG and WebP images are allowed",
      });
    }

    // Keep registration uploads separate from normal user uploads.
    const key =
      `profiles/registration/${registration._id}/` +
      `${randomUUID()}.${EXTENSIONS[contentType]}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    // Remember the one permitted profile image key for this session.
    registration.profileImageKey = key;
    await registration.save();

    return res.status(200).json({
      success: true,
      data: {
        key,
        uploadUrl,
        contentType,
        expiresIn: 300,
      },
    });
  } catch (error) {
    console.error("Registration S3 upload URL failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create registration upload URL",
    });
  }
};

export const getProfileImageSignedUrl = async (key) => {
  if (!key || typeof key !== "string") {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 3600,
  });
};