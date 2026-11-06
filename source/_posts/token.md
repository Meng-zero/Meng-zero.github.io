---
title: token
date: 2026-11-06 14:07:17
categories:
    - ai-agent
tags:
    - ai-agent-learning
describe: 第三节
---

OK啊，今天来讲讲所谓的token，用大模型都会关心花了多少token，那么这个究竟是什么？让我们一起进去看看  
这一节包含token、上下文窗口与成本  
token的产生有其必要性，计算机只能处理数字，不能直接理解文本，所以文本进入LLM之前，必须把它转化成为数字序列，这个过程叫做分词（tokenization），切出来的最小单元叫token（词元）  
那么为什么不直接按字符或者单词切呢？还要这种复杂的方式搞来搞去  
按单词切，空格和标点分隔，那么词表炸了，词太多了，万一再来个新词，就懵了  
按字符切，每个字母或者汉字单独一个，那么你学习的时候只给你一个g，你看出啥，这样模型的学习效率就低了  
所以LLM采用了折中方案：子词分词（subword tokenization）  

好了，你知道它用啥切词方案了，可是还是文本啊，咋换成数字？  
token和向量的关系  
{% asset_img 1.png 完整流程 %} 
每个token对应词表里的一个整数ID，然后通过嵌入矩阵（Embedding Matrix）把这个ID映射为一个高维向量（通常1024-12288维）  
这样模型就能理解说的是啥了，语义相近的token，向量也会接近  

token的简单原理：子词分词  
核心是常见词保持完整，罕见词拆成有意义的碎片  
比如  
```
tokenization -> token + ization
```

最主流的算法--BPE -> Byte-Pair Encoding  
原理：  
1. 初始化：把所有文本拆成最小的字符  
2. 统计：哪两个相邻字符出现频率最高  
3. 合并： 把这一对合并成一个新的token  
4. 循环至词表大小达到预设值  

{% asset_img 2.png BPE流程 %}

这样的好处：  
1. 词表可控  
2. 不怕新词  
3. 保留语义  

所以说token不是我们常见的词或字，而是介于它们之间的一个东西  

一般来说有这样的经验法则  
{% asset_img 3.png %}  

我们如何查看token的切分呢？  
可以用OpenAI的tiktoten库来查看任意文本被切成了什么token  

```python  
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")
text = "你好，世界！"

tokens = enc.encode(text)
pieces = [enc.decode([t]) for t in tokens]

print(f"Token 数: {len(tokens)}")
print(f"切分结果: {pieces}")
# → ['你', '好', '，', '世界', '！']
```  

为啥要在乎token？  
1. 这是计费单位  
2. 上下文窗口按token算  
上下文窗口里的是模型能够看懂的，因此不仅是因为你的money，还有你的agent工作能力都要对token精打细算  
3. 生成延迟跟token数线性相关  
在第一节里讲到，LLM是逐个token生成的，每一次都要做一次前向传播，因此详细意味着想得久，花的token多  

好了，接下来讲什么是上下文窗口  
说白了就是LLM的内存，它一次推理中最多只能看这么多东西（token）  
值得注意的是一下三点：  
1. 输入 + 输出 <= 上下文极限  
因为每次推理LLM要看的是你的Messages，所以有它的输出，也有你的输入  
2. 超出窗口 = 直接报错  
API不会“自动截断”，而是返回错误，算是拒绝你给它喂token到撑死，因此我们再用AI的时候，一个对话长了它会忘记过去，其实是前端主动裁掉了早期消息避免超限  
3. 越长越笨  
研究表明大部分模型在上下文超过50%容量后，对中间位置的关注度显著下降，也就是长文本中间的内容模型可能会忽略，叫“Lost in the Middle”现象  
