---
title: MCP&Skill&RAG
date: 2026-11-10 16:03:01
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第8节
---

这里是后面的预告，了解工具哪里来？怎么和能力打包成一个技能？喂给模型的是什么数据？

# MCP 工具协议化
我们自己手写ToolRegistry，所有工具都要写到Agent仓库里，想接github，slack，notion三个外部系统就需要你自己读三家的API文档然后自己手写schema，维护也要跟着改，就很。
MCP把这件事反过来，github/slack/notion各自跑一个MCP Server，它们自己声明我有哪些工具，参数是什么，我们的Agent只需要一个MCP客户端，连过去就能用。tool_calls协议不变，只是工具实现方从我们自己写变成了远程拉取

# Skill 工具 + 提示词 + 资源的打包
做成一件事的能力包含：1.工具（读PDF）；2.prompt（教模型什么时候用工具，怎么用）；3.一些资源（模板之类）
Skill就是把这三个东西打包在一个目录：
```text
skills/
└── pdf-fill/
    ├── SKILL.md          # 触发条件 + 调用约定（喂给 system prompt）
    ├── tools/            # 该 Skill 专属工具
    └── assets/           # 模板、样例
```
模型在system prompt里看见SKILL.md的描述，决定这个任务用pdf-fill Skill，把工具和知识打包成专家模块。

# RAG 把知识查询伪装成一个工具
先用向量检索从私有知识库捞top-k段落，再把这些段落塞进prompt，让模型基于这些内容回答
RAG在Agent里通常以一个工具的形态存在。
```python
@registry.tool("从公司内部知识库检索相关段落")
def search_kb(query: str, top_k: int = 5) -> str:
    vectors = embed(query)
    docs = vector_db.query(vectors, top_k=top_k)
    return "\n\n".join(d.content for d in docs)
```
这里只是简单小计，下一节应该会是5-8节重要代码的实现