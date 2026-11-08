---
title: agent&chatbot
date: 2026-11-08 10:42:57
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第5节
---
今天主要看看agent和chatbot的最大区别
agent在循环里反复调用llm + tool直到完成工作；chatbot只是一问一答的函数
来看看chatbot完成一次工作的流程
{% asset_img 1.png %}

再看看agent完成一次工作的流程
{% asset_img 2.png %}

agent程序里的loop环节让llm可以多次请求tool完成实时信息的获取来完成任务

面对一个需要实时获取信息的问题:
chatbot会不知道或者乱编一个回答
agent则会调用工具获得信息然后解决问题并回答

这个表格很不错
{% asset_img 3.png %}

我们所说的agent，也就是代理人，就是它帮我们回应llm，并调用llm。再看看harness，马具，llm是马，这些都是为了让llm的思考有回音，能调用工具，能决策啥时候做完了，agent程序，就是我们现在正在处理的问题。