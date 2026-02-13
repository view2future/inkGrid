import os
import base64
import io
import time
from typing import Optional, List, Dict, Any, Union
import PIL.Image
from openai import OpenAI, APIError, RateLimitError
import google.generativeai as genai

class VLMClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.max_image_size = (3072, 3072)
        self.jpeg_quality = 95

    def _get_image_bytes(self, img: PIL.Image.Image) -> bytes:
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=self.jpeg_quality, optimize=True)
        return buffer.getvalue()

class GeminiSDKClient(VLMClient):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        super().__init__(api_key or os.getenv("GOOGLE_API_KEY"))
        self.model_name = model or "models/gemini-2.0-flash"
        if not self.api_key: raise ValueError("GOOGLE_API_KEY not found.")
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def analyze_stele(self, image_path: str, prompt: str, **kwargs) -> str:
        from .preprocess import enhance_stele_image
        enhanced_path = "/tmp/enhanced_vlm.jpg"
        enhance_stele_image(image_path, enhanced_path)
        img = PIL.Image.open(enhanced_path)
        
        generation_config = {"temperature": 0.0, "max_output_tokens": 8192}
        
        # 修正分类名称
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]

        response = self.model.generate_content([prompt, img], generation_config=generation_config, safety_settings=safety_settings)
        return response.text

class MiniMaxClient(VLMClient):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        super().__init__(api_key or os.getenv("MINIMAX_API_KEY"))
        self.base_url = base_url or os.getenv("MINIMAX_BASE_URL", "https://api.minimax.chat/v1")
        # Use the recommended model for vision tasks
        self.model = model or os.getenv("MINIMAX_MODEL", "abab6.5s-chat")
        if not self.api_key:
            raise ValueError("MINIMAX_API_KEY not found.")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

    def analyze_stele(self, image_path: str, prompt: str, **kwargs) -> str:
        from .preprocess import enhance_stele_image
        enhanced_path = "/tmp/enhanced_minimax.jpg"
        enhance_stele_image(image_path, enhanced_path)
        
        img = PIL.Image.open(enhanced_path)
        # Convert to base64
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        },
                    ],
                }
            ],
            max_tokens=8192,
            temperature=0.01
        )
        return response.choices[0].message.content

def get_vlm_client(provider: str = "gemini", **kwargs) -> VLMClient:
    if provider.lower() == "minimax":
        return MiniMaxClient(**kwargs)
    return GeminiSDKClient()
