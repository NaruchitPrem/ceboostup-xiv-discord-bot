// ดึงค่าตัวแปรจากไฟล์ .env (เช่น Token)
require('dotenv').config();

// เรียกใช้คลาสที่จำเป็นจาก discord.js
const { Client, GatewayIntentBits } = require('discord.js');

// ตั้งค่าบอทและขอสิทธิ์ (Intents) การเข้าถึงข้อมูลต่างๆ ในเซิร์ฟเวอร์
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // สิทธิ์พื้นฐานในเซิร์ฟเวอร์
        GatewayIntentBits.GuildMembers,     // จำเป็นสำหรับการดึงข้อมูลคนเข้าเซิร์ฟเวอร์/ให้ยศ
        GatewayIntentBits.GuildMessages,    // สำหรับอ่านข้อความ
        GatewayIntentBits.MessageContent    // สำหรับอ่านเนื้อหาในข้อความ
    ]
});

// Event: ทำงาน 1 ครั้งเมื่อบอทล็อกอินและพร้อมใช้งาน
client.once('ready', () => {
    console.log(`✅ ล็อกอินสำเร็จ! บอทพร้อมทำงานในชื่อ ${client.user.tag}`);
});

// สั่งให้บอทล็อกอินโดยใช้ Token ที่ดึงมาจากไฟล์ .env
client.login(process.env.DISCORD_TOKEN);