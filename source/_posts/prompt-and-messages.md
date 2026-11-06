---
title: prompt_and_messages
date: 2026-11-06 13:19:16
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第二节
---

关于同一个LLM的不同表现，区别在于system prompt  

```python
# 正经模式
messages = [
    {"role": "system", "content": "你是一位专业的技术助手"},
    {"role": "user", "content": "你是谁？"}
]
# → "我是一个 AI 助手，可以帮你解决技术问题。"

# 猫娘模式
messages = [
    {"role": "system", "content": "你是一只猫娘，每句话以喵结尾"},
    {"role": "user", "content": "你是谁？"}
]
# → "我是一只可爱的猫娘喵～"
```

这是如何做到的？答案是messages协议  
messages协议是什么？  
首先，所有的OpenAI兼容的LLM API都使用同一种输入格式：  

```python
messages = [
    {"role": "system",    "content": "你是一个简洁的助手。"},
    {"role": "user",      "content": "什么是递归？"},
    {"role": "assistant", "content": "函数调用自身解决子问题。"},
    {"role": "user",      "content": "举个例子。"},
]
```  

1) 为什么需要这个协议  
大模型（LLM）本身是一个无状态函数  

```python
输出 = 模型(输入)
```  

调用一次返回一次，结束后啥也不记得。当我们所希望的是模型知道自己是谁，该咋说，哪句是它说的，前面说过啥  
Messages协议就是为了这个来的  
2) 三种核心角色role  
1. system--系统提示词，让模型换人设  
它是整个对话需求优先级的最高指令，用来设定模型人设、语气、规则和边界  
2. user--用户输入  
用户实际送达的信息。可以是各种东西，比如问题、指令、代码片段或者图片等  
3. assistant--模型之前的回复  
不是必须手写，而是在多轮对话时要由你的程序把模型的回复原样append到列表里，再作为下一轮的输入。这个正是“记忆”的实现方式  
4. tool相关角色  
调用函数或者工具时，会出现tool角色的消息，用于把函数返回值交还给模型。另外，assistant消息可以附带tool_calls字段来声明“我要调用哪个函数”。这个是构建Agent的基础  

一次完整的请求流程如下：  

```text
① 用户输入问题
        ↓
② 程序拼装 messages 列表
   [system] + [历史轮次] + [本次 user]
        ↓
③ HTTP 请求发往 API
        ↓
④ 模型读完整列表 → 生成下一条 assistant 回复
        ↓
⑤ 程序把回复追加进列表
   messages.append({"role": "assistant", "content": reply})
        ↓
⑥ 下一轮对话，再次发送完整列表 → 循环
```  

注意事项  
1. system不是万能的，模型仍然可能违反system指令。所以重要规则要写在system里，并最好在user里再强调一次  
2. 历史消息不能无限长，不能一口吃，最常见的做法是：保留最近N条 + 早期内容做摘要压缩  
3. content必须是字符串，多模态时不能直接塞字典，需要按供应商要求改写  
4. 不要手动伪造assistant消息，你还不是AI，所以不要试图模仿它的话，会让它认错的  
5. 角色约束有顺序，一般要求system在最前面，user和assistant交替出现  
6. temperature与人设配合，固定人设做精确输出时调低0.3左右，创意类调高0.8 - 1.0  
总之，Messages协议就是你们之间的聊天记录，以某种形式存储，然后每次对话ai调用后读这个历史对话再回答你  