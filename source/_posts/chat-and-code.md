---
title: chat and code
date: 2026-11-07 10:51:49
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 1~4节番外
---

这一节主要看看和大模型对话在代码里是什么样的  

先来介绍一下核心方法调用，client.chat.completions.create，用来发送一次请求给大模型  
# 核心参数  
1. messages（必填）  
这个就是模型的上下文  
2. model（必填）  
你选择的模型id，比如"deepseek-chat"  
3. stream（非必填，默认False）  
函数返回值完全取决于这个参数，后面会介绍两种返回方式  
4. temperature（非必填）  
模型回答是准确还是创造  
5. timeout（非必填）  
覆盖客户端级别的默认请求超时时间（秒）。对于可能需要长时间思考的复杂任务，可以适当调大这个值  

# 返回值  
1. stream = False
    1) 返回对象类型  
    完整的ChatCompletion对象  
    2) 核心结构  
    核心数据都在choices列表里，默认只有一个元素  

```python 
ChatCompletion(
    id="chatcmpl-...", 
    object="chat.completion",
    created=1700000000,
    model="deepseek-chat",
    choices=[
        Choice(
            index=0,
            message=ChatCompletionMessage(
                role="assistant",
                content="你好！有什么我可以帮你的吗？", # <--- 文本在这里
                tool_calls=None                       # 如果有工具调用，在这里
            ),
            finish_reason="stop"                      # 结束原因
        )
    ],
    usage=CompletionUsage(
        prompt_tokens=10,
        completion_tokens=15,
        total_tokens=25                               # 这次对话消耗的总token
    )
)
```

看来这样的结构发现resp.choices[0].message.content就是大模型给你的答复，但是如果模型触发工具调用，content可能是None，于是return一般会用or ""兜底  

2. stream = True
    1) 返回对象类型  
    Stream[ChatCompletionChunk]生成器对象。不同于非流式，这个对象像一个水管，需要for循环去不停接水  
    2) 核心结构拆解  
    每次循环拿到的chunk，结构和非流式类似，只是内容变成了增量  
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

所以如果你想要得到完整的content，需要把每一次的chunk里的content添加到一个列表里组装起来，值得注意的是关于一轮对话的token用量并不会在chunk里直接显示，所以要想看token用了多少，需要在请求时加上一个参数stream_options  
```python  
stream_options={"include_usage": True}  
```
加上之后流的末尾会多出一个特殊的chunk，它的choices列表是空的，但usage字段会包含完整的token统计  

OK啊，介绍了这么多不如来一次真正的对话，我这里以deepseek和VScode为例  

# 完成一次对话  
## 配置环境  
首先你有一个api_key，并添加到你的用户的环境变量里，可以参考下面这串指令，在终端执行  
```text  
[Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "密钥", "User")
```
这一步做好之后关掉你的VScode，清理掉缓存，再打开，在终端输入下面这个指令  
```text  
echo $env:DEEPSEEK_API_KEY  
```
如果终端输出了你的密钥就ok了，没有的话你可以点击Win，搜索编辑环境变量，点击右下的环境变量，看看上面user里是否有你的key，这样你就永久的部署好了这个api_key,以后用可以直接拿  

有了钥匙还不够，还需要找到门也就是建立一个客户端在你的代码里  
这就需要openai这个库了，基本上兼容大部分模型，直接终端安装就行  
```text  
pip install openai -i https://mirrors.aliyun.com/pypi/simple/  
```

## 初始化客户端  
这里开始基本上就是代码阶段了  

首先是需要用到的库
```python  
import os
from openai import OpenAI
```

然后就是初始化客户端了  
```python  
api_key = os.environ.get("DEEPSEEK_API_KEY")

if not api_key:
    raise ValueError("未读取到 DEEPSEEK_API_KEY 环境变量！请检查终端配置或改用硬编码测试。")

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com",
)
```
第一步配置环境就是为了那个api_key，如果你只是单纯玩玩，也可以直接把你的api_key写到那里，但不要让别人看见哦  
client那里就相当于找属于你的电脑和模型之间的门  
这一步搞好了就可以开始发起对话了 
如果执行代码发生了401报错，可能是你的api_key不对，402可能是没钱了

## 发起一次对话  
```python  
print("正在请求大模型，请稍候...\n")

response = client.chat.completions.create(
    model="deepseek-chat",  # 使用通用的对话模型
    messages=[
        {"role": "system", "content": "你是一个幽默的 AI 助手，回答要简短。"},
        {"role": "user", "content": "请用一句话介绍你自己。"}
    ],
    stream=False
)
```
这里直接用非流式，简单明了

## 获得回答  
```python  
# 提取并打印结果
reply = response.choices[0].message.content
print("🤖 模型的回复：")
print(reply)

# 打印本次消耗的 Token 数量（便于了解计费）
print("\n--- 消耗统计 ---")
print(f"输入 Tokens: {response.usage.prompt_tokens}")
print(f"输出 Tokens: {response.usage.completion_tokens}")
```

写这个主要是看非流式是如何找回答和你所需要的信息的

后面有空会单独做一期流式的返回结果，因为处理比较复杂