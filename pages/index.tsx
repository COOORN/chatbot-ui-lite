import { Chat } from "@/components/Chat/Chat";
import { Footer } from "@/components/Layout/Footer";
import { Navbar } from "@/components/Layout/Navbar";
import { Message } from "@/types";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { OpenAI } from "langchain/llms/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { LLMChain } from "langchain/chains";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "langchain/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const key = "INSERT";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chat = new ChatOpenAI({ openAIApiKey: key, temperature: 0.7 })
  const assistantPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful AI assistant that helps the user's productivity and task management. Do not offer to do tasks you cannot accomplish as of yet, since you are still improving. Try your best to ask follow up questions and keep the conversation going at all times. You have long term memory. These are their tasks/to-do's: {importantItems}. This is the history of your conversation so far with this user: {history}"
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);
  const chain = new LLMChain({
    prompt:assistantPrompt,
    llm: chat,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (message: Message) => {
    const updatedMessages = [...messages, message];

    setMessages(updatedMessages);
    setLoading(true);

    let messageHistory = "";
    for (let i = 0; i < updatedMessages.length; i++) {
      messageHistory = messageHistory.concat(`${updatedMessages[i].role}: ${updatedMessages[i].content};\n `)
    }


    if (localStorage.getItem("history") !== null){
      const contextInjection = await handleLoad(message.content);
      messageHistory = messageHistory.concat(String(contextInjection));
    }
    console.log(String(localStorage.getItem("importantItems")).concat("\n".concat(messageHistory)))

    if (localStorage.getItem("importantItems") === null) {
      var response = await chain.call({importantItems: "NONE SO FAR", history: messageHistory, text: message.content});
    }
    else {
      var response = await chain.call({importantItems: String(localStorage.getItem("importantItems")), history: messageHistory, text: message.content});
    }
    let isFirst = true;
    setLoading(true);

      if (isFirst) {
        isFirst = false;
        setMessages((messages) => [
          ...messages,
          {
            role: "assistant",
            content: response.text
          }
        ]);
        setLoading(false);
      } else {
        setMessages((messages) => {
          const lastMessage = messages[messages.length - 1];
          const updatedMessage = {
            ...lastMessage,
            content: lastMessage.content + response
          };
          setLoading(false);
          return [...messages.slice(0, -1), updatedMessage];
        });
      }
    }

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: `Hi there!`
      }
    ]);
  };

  const handleSave = async () => {
    let messageHistory:string;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `ON ${year}-${month}-${day}:`;

    if (localStorage.getItem("history") === null){
      messageHistory = `${dateString}: `; 
      for (let i = 0; i < messages.length; i++) {
        messageHistory = messageHistory.concat(`${messages[i].role}: ${messages[i].content};\n `)
      }
      localStorage.setItem("history", messageHistory);
      
    }
    else {
      messageHistory = String(localStorage.getItem("history"));
      messageHistory = messageHistory.concat(`${dateString}: `); 
      for (let i = 0; i < messages.length; i++) {
        messageHistory = messageHistory.concat(`${messages[i].role}: ${messages[i].content};\n `)
      }
      localStorage.setItem("history", messageHistory);
    }

    if (localStorage.getItem("importantItems") === null) {
      const importantItems = await chat.call([new HumanChatMessage(`This is the message history between you and the user: "${String(localStorage.getItem("history"))}" \n What are the tasks or to-do's the user has discussed about? Answer very concisely, and use specific dates if referencing dates`)])
      localStorage.setItem("importantItems", dateString.concat(importantItems.text));
    }
    else {
      const importantItems = await chat.call([new HumanChatMessage(`This is the message history between you and the user: "${String(localStorage.getItem("history"))}" \n These are the tasks you have for the user so far; "${String(localStorage.getItem('importantItems'))}".\n What are the tasks or to-do's the user has discussed about? Answer very concisely, and use specific dates if referencing dates.`)])
      localStorage.setItem("importantItems",String(dateString.concat(importantItems.text)));
    }
    handleReset();
  };

  const handleLoad = async (message:string) => {
    if (localStorage.getItem("history") !== null){
      const messageHistory:string = String(localStorage.getItem("history"));
      const splitter = new RecursiveCharacterTextSplitter({chunkSize:500,chunkOverlap:100});
      const output = await splitter.createDocuments([messageHistory]);
      const vectorStore = await MemoryVectorStore.fromDocuments(
        output,
        new OpenAIEmbeddings({openAIApiKey: key})
      );
      const results = await vectorStore.similaritySearch(message, 1);
      let resultConcat = "";
      for (let i = 0; i < results.length; i++) {
        resultConcat = resultConcat.concat(`${results[i].pageContent};`)
      }
      return resultConcat
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Hi there!`
      }
    ]);
  }, []);

  return (
    <>
      <Head>
        <title>Assist GPT</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <link
          rel="icon"
          href="/favicon.ico"
        />
      </Head>

      <div className="flex flex-col h-screen">
        <Navbar />

        <div className="flex-1 overflow-auto sm:px-10 pb-4 sm:pb-10">
          <div className="max-w-[800px] mx-auto mt-4 sm:mt-12">
            <Chat
              messages={messages}
              loading={loading}
              onSend={handleSend}
             // onReset={handleReset}
              onSave={handleSave}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
  }
