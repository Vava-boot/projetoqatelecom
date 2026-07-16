/**
 * src/middleware/upload.js
 * Recebe áudio em memória (sem gravar em disco — importante em plataformas
 * de deploy com sistema de arquivos efêmero/somente leitura).
 */
const multer = require("multer");
const { env } = require("../config/env");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_AUDIO_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
  },
});

module.exports = upload;
