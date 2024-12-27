import os
from openai import OpenAI

def test_api():
    try:
        client = OpenAI(
            api_key=os.environ.get("deepseek"),
            base_url="https://api.deepseek.com/v1"
        )
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": "Hello"}],
            stream=False
        )
        print("API Response:", response)
        return True
    except Exception as e:
        print("Error:", str(e))
        return False

if __name__ == "__main__":
    test_api()
