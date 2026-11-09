---
title: tool
date: 2026-11-08 13:37:21
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第6节
---

# Function Calling协议
Function Calling协议就是把“让LLM调工具”从“prompt字符串约定”升级到“OpenAI官方结构化字段”，从此调工具不再正则
这个协议主要看两个部分
## Tool Schema：给LLM的工具说明书
工具要能用，必须先写一份机器可读的说明书。以OpenAI为例
```python
{
    "type": "function",
    "function": {
        "name": "get_weather",                       # 工具名
        "description": "查询指定城市的当前天气",        # 干什么用的
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名，例如 '北京'",
                }
            },
            "required": ["city"],
        },
    },
}
```
LLM看了就知道了三件事：
1. 这个工具叫git_weather
2. 它能够“查询城市的当前天气”
3. 调用必须传入一个字符串city
LLM不会看这个函数咋实现，只知道咋用，所以description字段的质量决定了模型能不能用好这个工具

Tool Schema放在哪里？
LLM调用时多传一个参数
```python
resp = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    tools=[ ... 上面那个 schema ... ],   # ← 这里
    tool_choice="auto",                  # 让模型自己决定要不要调
)
```
关于tool_choice的取值
```python
"auto"                                            # 模型自己决定调用
"none"                                            # 这次绝对不调用工具
"required"                                        # 这次至少调用一个工具   
{"type": "function", "function": {"name": "xx"}}  # 这次必须调用xx
```

## 四种角色消息流
messages里的第四个角色：tool
```text
[1] system      "你是助手，可以用get_weather工具"
[2] user        "北京今天天气咋样"
[3] assistant   content = None
                tool_calls = [ {id:"call_001", name:"get_weather"}, args{"city": "北京"}]
[4] tool        tool_call_id = "call_001"
                content = "北京 晴 25°C"
[5] assistant   "北京今天晴朗 25°C，建议短袖加薄外套。"
```
值得关注的是：
1. content = None
这里调用了tool，content就可能是None了
2. assistant消息必须原样追加进messages
就是我们要保证上下文完整，让LLM记得自己做了什么决策
3. tool消息必须配tool_call_id
这个相当于要一一对应，哪次调用的结果是哪个
4. tool_calls是列表
这是因为模型可以一次返回多个tool_call，让你并行执行

# ToolRegistry
ToolRegistry是一个函数，目的是自动成为LLM能调用的工具
为什么需要ToolRegistry？
工具一多，你就需要大量的参数名、参数类型、required列表，维护麻烦，自己写着也麻烦所以需要它  

ToolRegistry的形式
```python
registry = ToolRegistry()

@registry.tool("查询指定城市的当前天气")
def get_weather(city: str) -> str:
    return f"{city} 晴 25°C"
```
这样，所需的name / parameters / required全部从函数签名自动读出来

调LLM时：
```python
resp = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    tools=registry.to_schemas(),    # ← 自动生成所有 schema
)

for tc in resp.choices[0].message.tool_calls:
    args = json.loads(tc.function.arguments)
    result = registry.invoke(tc.function.name, args)   # ← 自动调度
```

@registry.tool("...")把函数记录到了registry._funcs里，函数本身还是可以随意调用，，但是registry记录它了
ToolRegistry用Python自带的inspect.signature()读函数签名--参数名、类型注解、有没有默认值--再按一张映射表翻译成OpenAI schema。没有默认值的参数自动进required

这里是一个极简实现
```python
import inspect
from typing import Any, Callable

class ToolRegistry:
    _TYPE_MAP = {
        str: "string", int: "integer", float: "number",
        bool: "boolean", list: "array", dict: "object",
    }

    def __init__(self) -> None:
        self._funcs: dict[str, Callable] = {}
        self._descs: dict[str, str] = {}

    # ① 装饰器：注册函数
    def tool(self, description: str):
        def deco(func):
            self._funcs[func.__name__] = func
            self._descs[func.__name__] = description
            return func
        return deco

    # ② 自动生成 schema 列表
    def to_schemas(self) -> list[dict]:
        out = []
        for name, func in self._funcs.items():
            sig = inspect.signature(func)
            properties, required = {}, []
            for pname, p in sig.parameters.items():
                properties[pname] = {
                    "type": self._TYPE_MAP.get(p.annotation, "string"),
                    "description": f"参数 {pname}",
                }
                if p.default is inspect.Parameter.empty:
                    required.append(pname)
            out.append({
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
            })
        return out

    # ③ 按工具名调度
    def invoke(self, name: str, args: dict[str, Any]) -> str:
        if name not in self._funcs:
            return f"未知工具: {name}"
        try:
            return str(self._funcs[name](**args))
        except Exception as e:
            return f"工具 {name} 执行出错: {e}"
```
上面的几个设计取舍
1. 很多框架会去解析docstring自动当description。故意让description写在装饰器里
```python
@registry.tool("查询指定城市的当前天气")    # ← 显式写
def get_weather(city: str) -> str:
    """获取天气。"""                       # ← 不读这个
```
docstring经常写得“对人类讲”，而LLM看的description经常需要面向调用决策。强制显示给LLM避免歧义

2. 所用工具返回str
```python
def calculator(expr: str) -> str:
    return str(eval(expr))    # ← 强转字符串
```
tool消息的content就是字符串。直接返回更加方便

3. 异常被捕获、转成字符串返回
```python
def invoke(self, name, args):
    try:
        return str(self._funcs[name](**args))
    except Exception as e:
        return f"工具 {name} 执行出错: {e}"
```
让模型知道自己错了，再自己决定下一步

还有别的扩展之后再做。