import os
import re
from mitmproxy import http

class SteleInterceptor:
    def __init__(self):
        # 存储目录
        self.save_path = "intercepted_steles"
        if not os.path.exists(self.save_path):
            os.makedirs(self.save_path)
        print(f"[*] Interceptor started. Images will be saved to: {self.save_path}")

    def response(self, flow: http.HTTPFlow) -> None:
        # 1. 过滤目标域名 (六品堂相关域名通常包含 liupintang 或 lpt)
        target_domains = ["liupintang.com", "lptart.com", "shufazidian.com"]
        
        if any(domain in flow.request.pretty_host for domain in target_domains):
            # 2. 检查内容类型是否为图片
            content_type = flow.response.headers.get("Content-Type", "")
            
            if "image" in content_type:
                url = flow.request.url
                # 3. 尝试从 URL 提取文件名或特征
                # 比如从 URL: .../char/6211.jpg 提取 6211
                file_ext = ".jpg" if "jpeg" in content_type or "jpg" in content_type else ".png"
                
                # 清洗文件名：移除特殊字符
                filename = re.sub(r'[^\w\s-]', '_', url.split("/")[-1].split("?")[0])
                if not filename.endswith(file_ext):
                    filename += file_ext
                
                # 4. 保存图片
                image_data = flow.response.content
                filepath = os.path.join(self.save_path, filename)
                
                # 防止重复保存
                if not os.path.exists(filepath):
                    with open(filepath, "wb") as f:
                        f.write(image_data)
                    print(f"[+] Captured: {filename} from {flow.request.pretty_host}")

addons = [
    SteleInterceptor()
]
