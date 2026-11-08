---
title: chat_and_code_next
date: 2026-11-07 14:55:58
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 1~4节番外补充
---

# 流式返回值
这里主要看看流式返回值我们应该如何处理，因为cnb平台上是一般流式的返回  
这里我会将尝试把流式包装在函数里看着像一个非流式

直接上代码

```python
def chat(system_prompt: str, user_prompt: str) -> tuple[str, dict]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    resp = client.chat.completions.create(
        model = "deepseek-chat",
        messages = messages,
        stream = True,
        stream_options = {"include_usage": True},
    )

    full_content = []                 # 存储每个chunk里新增的delta.content
    usage_info = None                 # 存储本轮对话的token相关信息

    for chunk in resp:
        if chunk.usage:               # 如果这是最后的usage，该这样处理
            usage_info = {
                "prompt_tokens": chunk.usage.prompt_tokens,
                "completion_tokens": chunk.usage.completion_tokens,
                "total_tokens": chunk.usage.total_tokens
            }

        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta

        if delta and delta.content:
            full_content.append(delta.content)    #添加每次新增的content

    return "".join(full_content), usage_info
```

主要看看如何把每一次的增量合成成一个完整的返回值
可以结合这个结构看看，在1~4番外里介绍了的
```python  
ChatCompletionChunk(
    id="chatcmpl-...",
    object="chat.completion.chunk", # 注意这里多了 .chunk
    created=1700000000,
    model="deepseek-chat",
    choices=[
        ChunkChoice(
            index=0,
            delta=ChoiceDelta(          # 注意：不是 message，是 delta
                role="assistant",       # 第一块通常带 role
                content="你"            # <--- 增量文本在这里
            ),
            finish_reason=None          # 中间过程为 None
        )
    ]
)  
```

接下来是两种方式的完整代码，要运行请看看1~4番外的环境配置
```python
import os
from openai import OpenAI

# 1. 初始化客户端
# 建议使用 os.environ.get()，它比直接使用 [] 更安全，如果没找到环境变量不会直接报错崩溃
api_key = os.environ.get("DEEPSEEK_API_KEY")

if not api_key:
    raise ValueError("未读取到 DEEPSEEK_API_KEY 环境变量！请检查终端配置或改用硬编码测试。")

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com",
)

'''
# ==================================
#  非流式
# ==================================


# 2. 发起简单对话
print("正在请求大模型，请稍候...\n")

response = client.chat.completions.create(
    model="deepseek-chat",  # 使用通用的对话模型
    messages=[
        {"role": "system", "content": "你是一个幽默的 AI 助手，回答要简短。"},
        {"role": "user", "content": "请用一句话介绍你自己。"}
    ],
    stream=False
)

# 3. 提取并打印结果
reply = response.choices[0].message.content
print("🤖 模型的回复：")
print(reply)

# 4. 打印本次消耗的 Token 数量（便于了解计费）
print("\n--- 消耗统计 ---")
print(f"输入 Tokens: {response.usage.prompt_tokens}")
print(f"输出 Tokens: {response.usage.completion_tokens}")

'''

# ==================================
#  流式
# ==================================

def chat(system_prompt: str, user_prompt: str) -> tuple[str, dict]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    resp = client.chat.completions.create(
        model = "deepseek-chat",
        messages = messages,
        stream = True,
        stream_options = {"include_usage": True},
    )

    full_content = []
    usage_info = None

    for chunk in resp:
        if chunk.usage:
            usage_info = {
                "prompt_tokens": chunk.usage.prompt_tokens,
                "completion_tokens": chunk.usage.completion_tokens,
                "total_tokens": chunk.usage.total_tokens
            }

        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta

        if delta and delta.content:
            full_content.append(delta.content)

    return "".join(full_content), usage_info

if __name__ == "__main__":
    print("请求中，请稍后···")

    resp, usage_info = chat(
        system_prompt = "你是一个简洁的助手。",
        user_prompt = "用一句话解释什么是黑洞。"
    )

    print("🤖 最终回复：")
    print(resp)
    print(f"本次对话消耗{usage_info["total_tokens"]}token")
```

# 关于**kwargs
再介绍一个东西--**kwargs（ketword arguments,关键字参数）
**kwargs主要用来动态接受或传递任意数量的关键字参数  ，接下来看看该如何使用它吧 
1. 基础语法
```python
def test_kwargs(**kwargs):
    print(kwargs)
test_kwargs(temperature = 0.5, max_tokens = 100)
# 输出：{'temperature': 0.5, 'max_tokens': 100}
```
2. 在OpenAI SDK中的核心应用（动态传参）
直接看代码来看看它起的作用
```python
def chat_general(system_prompt: str, user_message: str, **kwargs) -> str:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    
    # kwargs 会变成一个字典，比如 {"temperature": 0.1, "max_tokens": 50}
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        # 使用 ** 解包，把字典里的参数原封不动传递给 API
        **kwargs 
    )
    return response.choices[0].message.content

# 调用场景 A：默认情况（不传额外参数）
reply_a = chat_general("你是助手", "你好")

# 调用场景 B：精确控制输出（传入了 temperature 和 max_tokens）
reply_b = chat_general(
    "你是助手", 
    "写一首诗", 
    temperature=0.1, 
    max_tokens=50
)
```
同一个函数的传参更加灵活，它像一个字典，把参数都包含在了里面，如果用户传了参数为非流式，但客户端只能用流式，你可以在函数里加上
```python
kwargs["stream"] = True
```
来进行切换，更加方便的兼容