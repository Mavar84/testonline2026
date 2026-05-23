import base64
import os
from functools import lru_cache

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    from insightface.app import FaceAnalysis
except Exception as error:  # pragma: no cover
    FaceAnalysis = None
    _IMPORT_ERROR = error
else:
    _IMPORT_ERROR = None


class VerifyRequest(BaseModel):
    foto_registrada: str
    foto_actual: str


class FaceVerifier:
    def __init__(self):
        self.model_name = os.getenv("FACE_MODEL_NAME", "buffalo_l")
        self.model_root = os.getenv("FACE_MODEL_ROOT", "/models")
        self.threshold = float(os.getenv("FACE_MATCH_THRESHOLD", "0.62"))
        self.min_det_score = float(os.getenv("FACE_MIN_DET_SCORE", "0.60"))
        self.min_face_ratio = float(os.getenv("FACE_MIN_FACE_RATIO", "0.04"))
        self.det_size = int(os.getenv("FACE_DET_SIZE", "640"))
        self.providers = [
            provider.strip()
            for provider in os.getenv("FACE_PROVIDERS", "CPUExecutionProvider").split(",")
            if provider.strip()
        ]
        self._app = None

    def ensure_loaded(self):
        if self._app is not None:
            return self._app
        if FaceAnalysis is None:
            raise RuntimeError(f"No se pudo importar insightface: {_IMPORT_ERROR}")
        app = FaceAnalysis(name=self.model_name, root=self.model_root, providers=self.providers)
        app.prepare(ctx_id=0, det_size=(self.det_size, self.det_size))
        self._app = app
        return app

    def _decode(self, data_url):
        if not data_url:
            raise ValueError("No se recibió ninguna imagen.")
        if "," in data_url:
            _, data_url = data_url.split(",", 1)
        image = np.frombuffer(base64.b64decode(data_url), dtype=np.uint8)
        frame = cv2.imdecode(image, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("No se pudo leer la imagen enviada.")
        return frame

    def _extract_face(self, data_url):
        frame = self._decode(data_url)
        app = self.ensure_loaded()
        faces = self._detect_faces_with_fallbacks(app, frame)
        if not faces:
            raise ValueError("No se detectó un rostro en la imagen.")

        face = max(faces, key=lambda item: (item.bbox[2] - item.bbox[0]) * (item.bbox[3] - item.bbox[1]))
        bbox = [float(value) for value in face.bbox]
        width = max(bbox[2] - bbox[0], 1.0)
        height = max(bbox[3] - bbox[1], 1.0)
        frame_height, frame_width = frame.shape[:2]
        area_ratio = float((width * height) / max(frame_height * frame_width, 1))

        embedding = getattr(face, "normed_embedding", None)
        if embedding is None:
            embedding = face.embedding
            embedding = embedding / np.linalg.norm(embedding)

        return {
            "embedding": np.asarray(embedding, dtype=np.float32),
            "det_score": float(getattr(face, "det_score", 0.0)),
            "face_ratio": round(area_ratio, 4),
            "bbox": [round(value, 2) for value in bbox],
        }

    def _detect_faces_with_fallbacks(self, app, frame):
        attempts = [frame]

        padded = cv2.copyMakeBorder(frame, 80, 80, 80, 80, cv2.BORDER_REPLICATE)
        attempts.append(padded)

        enlarged = cv2.resize(frame, None, fx=1.35, fy=1.35, interpolation=cv2.INTER_CUBIC)
        attempts.append(enlarged)

        height, width = frame.shape[:2]
        side = min(width, height)
        square_margin = int(side * 0.04)
        square_side = max(side - (square_margin * 2), 1)
        square_x = max((width - square_side) // 2, 0)
        square_y = max((height - square_side) // 2, 0)
        square_crop = frame[square_y:square_y + square_side, square_x:square_x + square_side]
        if square_crop.size:
            attempts.append(cv2.resize(square_crop, (width, height), interpolation=cv2.INTER_CUBIC))

        for candidate in attempts:
            faces = app.get(candidate)
            if faces:
                return faces
        return []

    def verify(self, foto_registrada, foto_actual):
        registrada = self._extract_face(foto_registrada)
        actual = self._extract_face(foto_actual)
        actual_mirror = self._extract_face(self._mirror_data_url(foto_actual))

        normal = self._build_result(registrada, actual, "normal")
        mirror = self._build_result(registrada, actual_mirror, "espejo")
        return max([normal, mirror], key=lambda item: (item["coincide"], item["similitud"]))

    def _mirror_data_url(self, data_url):
        frame = self._decode(data_url)
        mirror = cv2.flip(frame, 1)
        ok, encoded = cv2.imencode(".jpg", mirror)
        if not ok:
            raise ValueError("No se pudo procesar la imagen para validación.")
        return base64.b64encode(encoded.tobytes()).decode("utf-8")

    def _build_result(self, registrada, actual, orientacion):
        similarity = float(np.dot(registrada["embedding"], actual["embedding"]))
        det_score = round(min(registrada["det_score"], actual["det_score"]), 4)
        face_ratio = round(min(registrada["face_ratio"], actual["face_ratio"]), 4)
        coincide = (
            similarity >= self.threshold and
            det_score >= self.min_det_score and
            face_ratio >= self.min_face_ratio
        )
        return {
            "coincide": coincide,
            "similitud": round(similarity, 4),
            "similitud_coseno": round(similarity, 4),
            "similitud_histograma": None,
            "similitud_lbph": None,
            "similitud_orb": None,
            "umbral": round(self.threshold, 4),
            "det_score": det_score,
            "face_ratio": face_ratio,
            "orientacion": orientacion,
            "bbox_registrada": registrada["bbox"],
            "bbox_actual": actual["bbox"],
            "modelo": self.model_name,
        }


@lru_cache(maxsize=1)
def get_verifier():
    return FaceVerifier()


app = FastAPI(title="TestOnline Face Service", version="1.0.0")


@app.get("/health")
def health():
    verifier = get_verifier()
    verifier.ensure_loaded()
    return {
        "ok": True,
        "model_name": verifier.model_name,
        "threshold": verifier.threshold,
        "providers": verifier.providers,
    }


@app.post("/verify")
def verify(payload: VerifyRequest):
    verifier = get_verifier()
    try:
        return verifier.verify(payload.foto_registrada, payload.foto_actual)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
