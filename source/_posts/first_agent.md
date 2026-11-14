---
title: first_agent
date: 2026-11-14 14:06:13
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第5~8节番外
---
这一节主要实现一个toolregistry的类以及对应agent循环的main代码
包含两个代码包ToolRegistry.py和main.py
整个过程跟随代码前进，但不会止于代码

# ToolRegistry.py
所依赖的包
```python
from __future__ import annotations

import inspect
import json
from typing import Callable, Any, get_type_hints
```
*Callable*是类型注释中的可调用类型，就像函数这样的类型就是可调用类型，*Any*是任意类型，*get_type_hints*用来在运行时解析函数、类或模块的注解
```python
TYPE_MAP = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}
```
*get_type_hints*负责把注解求值成真实类型，*TYPE_MAP*把真实类型降维成JSON里的类型字符串，配合完成函数签名到schema的转换

接下来是类ToolRegistry里的实现环节
## 类实现

### 初始化
```python
def __init__(self) -> None:
    self._funcs: dict[str: Callable] = {}               # 存可调用的工具 name : func
    self._descs: dict[str: str] = {}                    # 工具描述 name : descs
    self._param_descs: dict[str: dict[str: str]] = {}   # 工具参数描述 name: param_descs
```
这里是初始化函数，对应的键值对在注释里表现

### 工具注册
```python
def tool(self, descs: str, param_descs: dict[str, str] | None = None):
    def decorator(func : Callable) -> Callable:
        name = func.__name__
        if name in self._funcs:
            raise ValueError(f"工具重复注册：{name}")
        self._funcs[name] = func
        self._descs[name] = descs
        self._param_descs[name] = param_descs or {}

        return func
        
    return decorator
```
工具注册，装饰时立刻调用tool，拿到decortor，再调用decortor，此时才把函数名，描述，参数描述塞进三个字典。内层函数真正的职责只有“登记”，不改变原函数行为


### 生成工具schema
```python
    def _func_to_schema(self, name: str) -> Any:
        func = self._funcs[name]
        sig = inspect.signature(func)
        hints = get_type_hints(func)

        properties: dict[str, dict] = {}
        required: list[str] = []

        for pname, param in sig.parameters.items():
            ann = hints.get(pname, str)
            properties[pname] = {
                "type": TYPE_MAP.get(ann, "string"),
                "description": self._param_descs[name].get(pname, f"参数{pname}")
            }
            if param.default is inspect.Parameter.empty:
                required.append(pname)

        return {
            "type": "function",
            "function": {
                "name": name,
                "description": self._descs[name],
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        }

    def to_schema(self) -> list[dict]:
        return [self._func_to_schema(n) for n in self._funcs]
```
生成相应的schema，*func*是可调用函数，也就是之前注册的工具，*sig*是函数中的参数，*properties*是所有的参数以及对应的描述所构成的列表*list[dict{name: param_desc}]*，*required*是必须填写的参数，也就是没有默认值

### 工具调用
```python
    def invoke(self, name: str, args: dict[str, Any]) -> str:
        if name not in self._funcs:
            return json.dumps({
                "error_type": "unknomn_tool",
                "message": f"未知工具: {name}"
            }, ensure_ascii = False)
        
        try:
            result = self._funcs[name](**args)
        except TypeError as e:
            return json.dumps({
                "error_type": "tool_error",
                "message": str(e),
            }, ensure_ascii = False)
        except Exception as e:
            return json.dumps({
                "error_type": "tool_error",
                "message": str(e)
            }, ensure_ascii = False)
        return result if isinstance(result, str) else json.dumps(result, ensure_ascii = False)
```
工具调用这边最关键只用一句话
```python
result = self._funcs[name](**args)
```
这是调用并运行函数的那句语法，其他的就是函数执行失败发生了什么，值得注意的是错了也要返回，让LLM知道错了，什么原因错的，后续该怎么做

到这里，最简单的工具注册类就实现了。对每段代码进行了简单的解析，希望能够理解这个简单的工具注册类

# main.py
这里将会利用第一次番外中的知识获得一个LLMClient类，来编写main，这里主要是实现的最小agent_loop

## 依赖包
```python
from llm import LLMClient
from tool import ToolRegistry
import json
```

## 建立客户端并且创建工具箱
```python
registry = ToolRegistry()
client = LLMClient()
```

## 创建工具并注册
```python
@registry.tool(
    "获得指定范围内的随机整数",
    param_descs = {"a" : "区间的最小数", "b": "区间的最大数"}
)
def get_randint(a: int, b: int) -> int:
    import random
    return random.randint(a, b)
```

## agent loop
```python
def agent_loop(user_input: str, max_turn: int = 10) -> str:
    messages = [
        {"role": "system", "content": "你是一个助手，别人让你做什么你就做什么"},
        {"role": "user", "content": user_input}
    ]

    schemas = registry.to_schema()

    for _ in range(max_turn):
        resp = client.agent_chat(
            messages = messages,
            tools = schemas,
            tool_choice = "auto",
            temperature = 2
        )

        msg = resp.choices[0].message
        messages.append(msg)
        if not msg.tool_calls:
            return msg.content or ""

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError as e:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": f"错误：参数不是合法 JSON：{e}",
                })
                continue

            result = registry.invoke(name, args)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

        # print(messages)
    return "已达最大轮次，未能完成"
```
写这个循环的时候因为有点长，所以一定要注意缩进，别的就是之前讲的agent_loop了，不多说了

## 入口
```python
if __name__ == "__main__":
    print(agent_loop(user_input = "生成1到100的随机整数", max_turn = 10))
```

最后关于LLMClient的实现后续会补充，希望能理解，还有好多没写进去的实现，之后会继续