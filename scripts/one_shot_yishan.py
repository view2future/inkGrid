import os
import google.generativeai as genai
import PIL.Image

def run():
    genai.configure(api_key="AIzaSyBk4p4zNmA3zsaMsRLonpqzpMuDmW8w-x8")
    model = genai.GenerativeModel("models/gemini-2.0-flash")
    img_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    img = PIL.Image.open(img_path)
    prompt = "你是书法专家。请识别图中所有汉字。输出格式：序号 | [ymin, xmin, ymax, xmax] | 简体字"
    
    print("Requesting Gemini...")
    try:
        response = model.generate_content([prompt, img])
        print("Raw Output:\n" + response.text)
        
        output_dir = "final_yishan_slices"
        os.makedirs(output_dir, exist_ok=True)
        
        for line in response.text.strip().split('\n'):
            if '|' in line:
                try:
                    p = [s.strip() for s in line.split('|')]
                    bbox = [int(v.strip()) for v in p[1].replace('[','').replace(']','').split(',')]
                    w, h = img.size
                    img.crop((int(bbox[1]*w/1000), int(bbox[0]*h/1000), int(bbox[3]*w/1000), int(bbox[2]*h/1000))).save(
                        os.path.join(output_dir, "{}_{}.jpg".format(p[0], p[2]))
                    )
                    print("Saved {}_{}.jpg".format(p[0], p[2]))
                except: pass
    except Exception as e:
        print("Error: {}".format(e))

if __name__ == "__main__":
    run()