import google.generativeai as genai
import os

API_KEY = "AIzaSyBk4p4zNmA3zsaMsRLonpqzpMuDmW8w-x8"
genai.configure(api_key=API_KEY)

print("Listing available models:")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model: {m.name}, Display Name: {m.display_name}")
except Exception as e:
    print(f"Error: {e}")
