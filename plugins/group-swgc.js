import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
import path from "path";

const TMP = path.join(process.cwd(), "tmp");

async function ensureTmp() {
  try {
    await fs.mkdir(TMP, { recursive: true });
  } catch {}
}

export default {
  command: "swgc",
  alias: ["broadcastgroup", "bcgc"],
  disabled: false,
  
  async handler(m, { conn, text, isOwner }) {
    if (!isOwner) return m.reply("Owner only command");
    
    await ensureTmp();
    
    let content = {};
    let tempFile;
    
    // Check if replying to media
    const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage;
    if (quoted) {
      const quotedMsg = typeof quoted === 'object' ? quoted : m.quoted.msg;
      const mtype = Object.keys(quotedMsg || {})[0];
      
      let buffer;
      try {
        if (mtype === "imageMessage" || /image/.test(mtype)) {
          buffer = await conn.downloadMediaMessage(m.quoted || { message: quotedMsg });
        } else if (mtype === "videoMessage" || /video/.test(mtype)) {
          buffer = await conn.downloadMediaMessage(m.quoted || { message: quotedMsg });
        } else if (mtype === "audioMessage" || /audio/.test(mtype)) {
          buffer = await conn.downloadMediaMessage(m.quoted || { message: quotedMsg });
        } else if (mtype === "documentMessage" || /document/.test(mtype)) {
          buffer = await conn.downloadMediaMessage(m.quoted || { message: quotedMsg });
        }
      } catch (e) {
        return m.reply("Failed to download quoted media");
      }
      
      if (buffer) {
        const ft = await fileTypeFromBuffer(buffer);
        const ext = ft?.ext || "bin";
        tempFile = path.join(TMP, `tmp_${Date.now()}.${ext}`);
        await fs.writeFile(tempFile, buffer);
        
        if (/image/.test(mtype)) {
          content.image = { url: tempFile };
          if (text) content.caption = text;
        } else if (/video/.test(mtype)) {
          content.video = { url: tempFile };
          if (text) content.caption = text;
        } else if (/audio/.test(mtype)) {
          if (text) {
            await fs.unlink(tempFile).catch(() => {});
            return m.reply("Audio cannot have a caption");
          }
          content.audio = { url: tempFile };
          content.ptt = false;
        } else {
          await fs.unlink(tempFile).catch(() => {});
          return m.reply("Reply must be an image, video, or audio");
        }
      } else {
        return m.reply("Media is not valid or cannot be processed");
      }
    } else if (text) {
      content.text = text;
    } else {
      return m.reply("Send media (photo/video/audio) or text, either by replying or directly");
    }
    
    if (content.text && !content.text.trim()) {
      return m.reply("Text cannot be empty");
    }
    
    // Get group list
    const grupList = Object.keys(conn.chats || {}).filter(v => v.endsWith("@g.us"));
    const validGroups = [];
    
    validGroups.push({
      title: "All Groups",
      description: `Total ${grupList.length} groups`,
      id: `sendstatus all ${encodeURIComponent(JSON.stringify(content))}`,
    });
    
    for (const gid of grupList) {
      try {
        const metadata = await conn.groupMetadata(gid);
        validGroups.push({
          title: metadata.subject,
          description: gid,
          id: `sendstatus ${gid} ${encodeURIComponent(JSON.stringify(content))}`,
        });
      } catch {}
    }
    
    if (!validGroups.length) {
      if (tempFile) {
        try { await fs.unlink(tempFile); } catch {}
      }
      return m.reply("No valid groups available to select from");
    }
    
    // Create interactive message for group selection
    const sections = [{
      title: "Select Groups",
      rows: validGroups.map((g, i) => ({
        title: g.title,
        description: g.description,
        rowId: g.id,
      }))
    }];
    
    return conn.sendMessage(m.chat, {
      text: "Select target groups:",
      footer: "SWGC - Broadcast to Groups",
      sections: sections,
      buttonText: "SELECT GROUP"
    }, { quoted: m });
  }
};
