---
title: mini_agent_loop
date: 2026-11-09 21:59:35
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第7节
---

这一节是最小agent_loop，有了上一节Tool的加入加上这个loop，agent就能真正干活了

# 简单的代码实现
接下来通过一份代码拆解看看是怎么个循环法，你可以把代码从头到尾直接复制然后运行

## 需要的库
```python
import os
import json
from openai import OpenAI
```
这里除了json是之前没出现过的，另外两个算是常客了
后面拓展简单介绍一下这个json是啥

## 环境与客户端
```python
api_key = os.environ.get("DEEPSEEK_API_KEY")
if not api_key:
    raise ValueError(...)

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com",
)

MODEL = os.getenv("AGENT_MODEL", "deepseek-chat")
```
这一步因人而异，就是为了给你的代码也是agent建立与LLM的连接通道，主要就需要改api_key和base_url

##  随机工具实现
```python
def get_weather(city: str) -> str:
    return f"{city} 今天晴，25°C"
```
这个只是个简单实现，指挥返回固定字符串
关键点：
1. 参数city: str有类型注解。这不是装饰，而是后面JSON Schema的事实来源，否则schema就无法一致
2. 返回str：tool消息的content必须是字符串，工具内部就要把复杂结构序列化好

## 极简注册表
```python
TOOLS = {
    "get_weather": {
        "fn": get_weather,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "查询指定城市的当前天气",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string", "description": "城市名"}
                    },
                    "required": ["city"],
                },
            },
        },
    }
}
```
把“可执行函数”和“给模型看的schema”用同一个键绑在一起
关键点：
1. fn是python调用时的目标，schema是发给模型的描述，二者通过字典键"get_weather"对齐。这是ToolRegistry的退化形态，只有注册和查找，没有权限、子集、检索
2. schema里parameters.required: ["city"]和函数签名一致，用来保证正确传参
3. description是模型判断该不该用这个工具的依据

## 核心：agent loop
```python
def run_agent(user_input: str, max_turns: int = 8) -> str:
    messages = [
        {"role": "system", "content": "你是一个助手，需要时调用工具。"},
        {"role": "user", "content": user_input},
    ]
    schemas = [t["schema"] for t in TOOLS.values()]

    for _ in range(max_turns):
        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=schemas,
            tool_choice="auto",
        )
        msg = resp.choices[0].message
        messages.append(msg)              # 关键：assistant 消息必须原样回填

        if not msg.tool_calls:            # 模型不再调工具 → 收敛，返回最终回答
            return msg.content

        for tc in msg.tool_calls:         # 逐个执行（天然支持并行调用）
            name = tc.function.name
            args = json.loads(tc.function.arguments or "{}")
            entry = TOOLS.get(name)
            try:
                result = entry["fn"](**args) if entry else f"错误：未知工具 {name}"
            except Exception as e:
                result = f"错误：{e}"     # 错误也作为结果回填，让模型自我纠正
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,    # 必须与 tool_call 的 id 对应
                "content": str(result),
            })

    return "已达到最大轮次，未能完成。"
```
这一部分主要看注解理解这个循环的每轮的逻辑
循环里每轮tools=schemas相同，messages会添加每一轮的结果
整个过程的逻辑是
获得工具 -> 开始循环 -> 调用模型看message -> message添加新回复 -> 判断是否收敛（没有工具调用） -> 调用工具 -> 将工具结果添加到message -> 结束循环，返回结果

## 入口
```python
if __name__ == "__main__":
    print(run_agent("北京今天天气怎么样？"))
```

代码实现大概就这样，这是agent的骨架，还有别的东西能添加

# 简单聊聊json
一种轻量级、基于文本的数据交换格式。现在几乎所有编程语言都支持json的解析和生成

json数据由两种结构组成：
1. 对象：无序的键值对集合，用花括号{}表示
2. 数组：有序的值列表，用方括号[]表示
键必须是双引号包裹的字符串，值可以是：字符串、数字、布尔值、null、对象、数组
```json
{
  "name": "张三",
  "age": 25,
  "isStudent": false,
  "skills": ["Java", "Python", "SQL"],
  "address": {
    "city": "北京",
    "zip": "100000"
  },
  "nickname": null
}
```