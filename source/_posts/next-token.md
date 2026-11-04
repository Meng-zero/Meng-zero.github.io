---
title: next-token
date: 2026-11-04 18:01:40
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第一节
---

正文从这里开始

LLM怎么猜下一个词的  

首先看LLM本质：它不是数据库，它在做的是概率采样。那么什么算是概率采样呢？  

你说一句“今天天气真”，模型会计算下一个token（当作要填在后面的字）的概率分布。比如“好”是0.35，“热”是0.22，“冷”是0.15，“不错”是0.08，“糟糕”是0.05。然后选了一个token（比如“好”），之后新的输入是“今天天气真好”，模型会继续计算下一个可能的token，直到生成完毕。那么模型的下一个token为什么选这个呢？  

这个就要看一个关键参数Temperature：这个参数理解为控制“随机程度”的旋钮。  
temperature = 0，会贪心最高，用于代码生成和事实问答  
temperature = 0.3~0.7，大概率选高分词，偶尔冒险，用于日常对话和写作  
temperature = 1.0+，更均匀随机采样，输出更发散，用于头脑风暴、创意写作  

模型该如何计算token，并满足我们的一般需求呢？  

1. Transformer架构  
LLM的底层架构叫Transformer，它的核心能力是Attention机制，即在下一个token预测时回头看前面所有的token，并决定重点关注哪些，这个能力让LLM能处理长文本。另外的优势是Transformer在训练时能并行处理整段文本中所有位置的预测，不需要从头到尾计算，意味着可以同时用许多GPU训练。  

2. 预训练  
这里就类似传统机器学习中的有监督的模型训练，训练数据多了，自然模型就更加智能了。但是这时的模型只是一个“文本接龙”  

3. 对齐：SFT + RLHF  
让模型学会当助手：  
SFT（监督微调）：用“人类提问->优质回答”的示范数据继续训练，让模型学会以对话格式回答  
RLHF（基于人类反馈的强化学习）：人类对多个回答排序打分，让模型学会“人类喜欢的回答方式”，让回答更加人性化  

有了这些，LLM就能够理解咱们说的是啥了  

关于涌现：参数多就涌现了智能，主打一个力大砖飞  
几百万参数只能生成语法基本对的句子，几亿参数能写小文章，但事实经常错，几十亿参数能解简单题、写正确的代码片段，几千亿参数能做复杂推理、跟人深入对话、写长文档  
next-token prediction + 海量数据 + 巨大规模 -> 智能  

你可以把这个当作一个学习过程，人的学习可以理解为不同的神经元之间建立联系，LLM的训练过程也是这样，每次参数的调节都是建立每个神经元单位的过程  

如果有兴趣可以自己玩玩这个代码，也是一个文本接龙，其实是狗屁不通文本生成器。
这里的words是基于前缀次数的列表，相当于LLM里的参数，没有temperature这样的调节参数

'''python
#读入训练集
def load_text():
    data=[]
    with open("your_txt_path","r",encoding="utf-8") as f: #改动你的训练数据地址
        for line in f:
            list=line.split(" ")
            for word in list:
                data.append(word)
    return data
words=load_text()

#学习训练集
n=len(words)
learning_={}
for i in range(n-2):
    w1,w2,w3=words[i],words[i+1],words[i+2]
    pre=(w1,w2)
    if pre not in learning_:
        learning_[pre]=[]
    learning_[pre].append(w3)

import random
random.seed()

#根据训练集随机生成特定长度文本
start_pre=random.choice(list(learning_.keys()))
cur_w1,cur_w2=start_pre
ans=[cur_w1,cur_w2]

m=int(input("please input the length of passage:"))

for i in range(m-2):
    nxt_=list(learning_[(cur_w1,cur_w2)])
    nxt_w=random.choice(nxt_)
    ans.append(nxt_w)
    cur_w1,cur_w2=cur_w2,nxt_w

print(" ".join(ans))
'''