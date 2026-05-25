require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ---------------------------------------------------------
// ตั้งค่า ID ยศ (Role IDs) ให้ตรงกับชื่อใน Google Sheet
// ---------------------------------------------------------
const houseRoles = {
    "The Magician": "1498983057817079950",
    "Justice": "1508333585483174019",
    "Strength": "1504816949824196629",
    "Temperance": "1501165605422633040",
    "The Chariot": "1508334036580306954",
    "The Emperor": "1508339327812243558",
    "The Empress": "1508339493940232212",
    "The Hierophant": "1508339889857499167",
    "The High Priestess": "1508340109676642338",
    "The Lovers": "1508340242732810391",
    "The Star": "1508340513709756416",
    "The World": "1508340681587032225",
};

const majorRoles = {
    "Cyber": "1501150391205757051",
    "CE65": "1501150271861035109"
};

// ---------------------------------------------------------
// ตั้งค่า Google Sheets
// ---------------------------------------------------------
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

client.once(Events.ClientReady, () => {
    console.log(`✅ ล็อกอินสำเร็จ! บอทพร้อมทำงานในชื่อ ${client.user.tag}`);
});

// ---------------------------------------------------------
// ระบบเสกปุ่ม Verify (!setup)
// ---------------------------------------------------------
client.on(Events.MessageCreate, async message => {
    if (message.content === '!setup' && message.member.permissions.has('Administrator')) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_button')
                    .setLabel('ยืนยันตัวตน (Verify)')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
            );

        await message.channel.send({ 
            content: 'เทส\n*(กดปุ่มด้านล่างเพื่อยืนยันตัวตนรับยศ)*', 
            components: [row] 
        });
        await message.delete();
    }
    if (message.content === '!setup-staff') {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_staff_button')
                    .setLabel('🛠️ ยืนยันตัวตน (Staff)')
                    .setStyle(ButtonStyle.Primary),
            );

        await message.channel.send({ 
            content: '📌 **สำหรับ Staff:** กดปุ่มด้านล่างเพื่อรับยศ Staff ครับ', 
            components: [row] 
        });
        
        await message.delete();
    }
});

// ---------------------------------------------------------
// ระบบเมื่อคนกดปุ่ม (ทั้งผู้เข้าร่วมปกติ และ Staff)
// ---------------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
    // เช็คแค่ว่าเป็นการกดปุ่มหรือไม่ (เอาการบล็อกชื่อปุ่มออกแล้ว)
    if (!interaction.isButton()) return;

    // ------------------------------------------------
    // 1. ระบบของปุ่ม Verify ผู้เข้าร่วมปกติ
    // ------------------------------------------------
    if (interaction.customId === 'verify_button') {
        await interaction.deferReply({ ephemeral: true });

        try {
            await doc.loadInfo();
            const sheet = doc.sheetsByIndex[0];
            const rows = await sheet.getRows();
            const reportChannelId = process.env.REPORT_CHANNEL_ID;

            const userData = rows.find(row => row.get('Discord ID') === interaction.user.id);

            if (userData) {
                const houseName = userData.get('House');
                const majorName = userData.get('Major');

                const houseRoleId = houseRoles[houseName];
                const majorRoleId = majorRoles[majorName];

                const rolesToAdd = [];
                if (houseRoleId) rolesToAdd.push(houseRoleId);
                if (majorRoleId) rolesToAdd.push(majorRoleId);

                if (rolesToAdd.length > 0) {
                    await interaction.member.roles.add(rolesToAdd);
                    await interaction.editReply(`✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับ **${houseName}** (${majorName}) ครับ!`);
                } else {
                    await interaction.editReply(`⚠️ พบข้อมูลคุณในระบบ แต่บอทหายศในเซิร์ฟเวอร์ไม่เจอ กรุณาติดต่อที่ช่อง <#${reportChannelId}> ครับ`);
                }
            } else {
                await interaction.editReply(`❌ ไม่พบข้อมูล Discord ID ของคุณในระบบ! กรุณาติดต่อที่ช่อง <#${reportChannelId}> ครับ`);
            }
        } catch (error) {
            console.error(error);
            const reportChannelId = process.env.REPORT_CHANNEL_ID;
            await interaction.editReply(`🚨 เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลครับ กรุณาติดต่อที่ช่อง <#${reportChannelId}> ครับ`);
        }
    }

    // ------------------------------------------------
    // 2. ระบบของปุ่ม Staff (แจกยศ Staff ทันที)
    // ------------------------------------------------
    else if (interaction.customId === 'verify_staff_button') {
        await interaction.deferReply({ ephemeral: true });

        try {
            const staffRoleId = process.env.STAFF_ROLE_ID;

            if (!staffRoleId) {
                return await interaction.editReply(`⚠️ ไม่พบการตั้งค่า STAFF_ROLE_ID ในไฟล์ .env ครับ`);
            }

            if (interaction.member.roles.cache.has(staffRoleId)) {
                return await interaction.editReply(`ℹ️ คุณมียศ Staff เรียบร้อยแล้วครับ ไม่ต้องกดซ้ำนะ!`);
            }

            // แอดมินแจกยศ Staff ให้ทันที
            await interaction.member.roles.add(staffRoleId);
            
            await interaction.editReply(`✅ ยืนยันตัวตนสำเร็จ! คุณได้รับยศ **Staff** เรียบร้อยแล้วครับ🛠️`);

        } catch (error) {
            console.error('Staff Verify Error:', error);
            await interaction.editReply(`🚨 เกิดข้อผิดพลาด! กรุณาเช็คว่ายศของบอทอยู่สูงกว่ายศ Staff หรือยังครับ`);
        }
    }
});

// ----------------------------------------------------------
// ระบบต้อนรับคนเข้าเซิร์ฟเวอร์ (Welcome Message)
// ---------------------------------------------------------
client.on(Events.GuildMemberAdd, async member => {
    try {
        // ดึง ID ช่องต้อนรับ และช่อง verify จากไฟล์ .env
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        const verifyChannelId = process.env.VERIFY_CHANNEL_ID; 
        
        if (!welcomeChannelId) return;

        const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId);

        if (welcomeChannel) {
            // ส่งข้อความต้อนรับ (สามารถแก้ข้อความตรงนี้ได้ตามใจชอบเลยครับ)
            await welcomeChannel.send(`🎉 ยินดีต้อนรับ <@${member.id}> สู่เซิร์ฟเวอร์ **CE BOOSTUP XIV** ครับ!\nอย่าลืมไปที่ช่อง <#${verifyChannelId}> เพื่อกดปุ่มยืนยันตัวตนรับยศนะครับ✅`);
        }
    } catch (error) {
        console.error('🚨 เกิดข้อผิดพลาดในการส่งข้อความต้อนรับ:', error);
    }
});

// ---------------------------------------------------------
// 🌐 สร้าง Web Server จำลอง เพื่อให้ UptimeRobot คอยยิงมาปลุกบอท
// ---------------------------------------------------------
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot CE BOOSTUP XIV is running 24/7!');
}).listen(process.env.PORT || 3000, () => {
    console.log('🌐 Web Server สำหรับสแตนบายบน Render พร้อมทำงานแล้วครับ!');
});

client.login(process.env.DISCORD_TOKEN);