---
title: LLMClient
date: 2026-11-14 18:49:55
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: LLMClient
---

补充一下LLMClient类的实现，包含建立客户端，以及动态传参的message请求，包含流式与非流式的文本返回和agent可读返回

# 类实现

## 初始化（建立客户端）
```python
    def __init__(self):
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("未读取到 DEEPSEEK_API_KEY 环境变量！请检查终端配置或改用硬编码测试。")

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
        self.model = "deepseek-chat"
```

## 非流式文本返回
```python
        def chat(self, messages: list[dict], **kwargs) -> str:
            resp = self.client.chat.completions.create(
                model = self.model,
                messages = messages,
                **kwargs
            )
            return resp.choices[0].message.content or ""
```

## 流式文本返回
```python
    def chat_stream(self, messages: list[dict], **kwargs) -> tuple:
        kwargs["stream"] = True
        kwargs["stream_options"] = {"include_usage": True}
        resp = self.client.chat.completions.create(
            model = self.model,
            messages = messages,
            **kwargs
        )

        full_content = []
        usage_info = None

        for chunk in resp:
            if chunk.usages:
                usage_info = {
                    "prompt_tokens": chunk.usage.prompt_tokens,
                    "completion_tokens": chunk.usage.completion_tokens,
                    "total_tokens": chunk.usage.total_tokens
                }
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                full_content.append(chunk.choices[0].delta.content)

        return "".join(full_content) or "", usage_info
```

## agent非流式
```python
        def chat(self, messages: list[dict], **kwargs) -> str:
            resp = self.client.chat.completions.create(
                model = self.model,
                messages = messages,
                **kwargs
            )
            return resp.choices[0].message.content or ""
```

## agent流式
```python
    def agent_chat_stream(self, messages: list[dict], **kwargs):
        kwargs["stream"] = True
        kwargs["stream_options"] = {"include_usage": True}

        resp = self.client.chat.completions.create(
            model = self.model,
            messages = messages,
            **kwargs,
        )

        full_content: list[str] = []
        tool_calls_acc: dict[int, dict] = {}
        usage_info = None

        for chunk in resp:
            if getattr(chunk, "usage", None):
                usage_info = {
                    "prompt_tokens": chunk.usage.prompt_tokens,
                    "completion_tokens": chunk.usage.completion_tokens,
                    "total_tokens": chunk.usage.total_tokens,
                }

            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta

            if delta.content:
                full_content.append(delta.content)
                yield {
                    "type": "content",
                    "delta": delta.content,
                }

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    slot = tool_calls_acc.setdefault(
                        tc.index,
                        {
                            "id": "",
                            "type": "function",
                            "function": {
                                "name": "",
                                "arguments": "",
                            },
                        },
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.fuction:
                        if tc.function.name:
                            slot["function"]["name"] += tc.function.name
                        if tc.function.arguments:
                            slot["function"]["arguments"] += tc.function.arguments
                    yield {
                        "type": "tool_call_delta",
                        "index": tc.index,
                    }
            complete_message = {
                "role": "assistant",
                "content": "".join(full_content) or ""
            }

            if tool_calls_acc:
                complete_message["tool_calls"] = list(tool_calls_acc.values())

            yield{
                "type": "complete",
                "message": complete_message,
                "usage": usage_info,
            }
```

大部分都是之前的框架，就不再多说了，\( \\\ /\ o /\ \\\ )/