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
    "The Magician": "1498983057817079950", // เปลี่ยนเป็น ID ยศจริงที่ใช้เทส
    // ไว้ค่อยมาเพิ่มบ้าน 2-12 ทีหลังได้ครับ
};

const majorRoles = {
    "Cyber": "1501150391205757051", // เปลี่ยนเป็น ID ยศจริงที่ใช้เทส
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
});

// ---------------------------------------------------------
// ระบบเมื่อคนกดปุ่ม (เช็ค Sheet + ให้ยศแบบแจ้งเตือนในช่อง)
// ---------------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'verify_button') return;

    // บอก Discord ว่ากำลังประมวลผล (ข้อความจะเห็นแค่คนกด)
    await interaction.deferReply({ ephemeral: true });

    try {
        await doc.loadInfo(); 
        const sheet = doc.sheetsByIndex[0]; 
        const rows = await sheet.getRows(); 

        // ค้นหาแถวที่ Discord ID ตรงกับคนที่กดปุ่ม
        const userData = rows.find(row => row.get('Discord ID') === interaction.user.id);

        if (userData) {
            const houseName = userData.get('House');
            const majorName = userData.get('Major');

            const houseRoleId = houseRoles[houseName];
            const majorRoleId = majorRoles[majorName];

            const rolesToAdd = [];
            if (houseRoleId) rolesToAdd.push(houseRoleId);
            if (majorRoleId) rolesToAdd.push(majorRoleId);

            // ถ้าระบบเจอยศที่จะต้องให้
            if (rolesToAdd.length > 0) {
                await interaction.member.roles.add(rolesToAdd);
                await interaction.editReply(`✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับสู่ **${houseName}** (${majorName}) ครับ!`);
            } else {
                await interaction.editReply(`⚠️ พบข้อมูลคุณในระบบ แต่บอทหายศในเซิร์ฟเวอร์ไม่เจอ กรุณาติดต่อ Staff ครับ`);
            }
        } else {
            // ถ้าไม่เจอ ID ในชีท
            await interaction.editReply(`❌ ไม่พบข้อมูล Discord ID ของคุณในระบบ! กรุณาติดต่อฝ่าย Data เพื่อลงทะเบียนครับ`);
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply(`🚨 เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลครับ กรุณาแจ้ง Staff`);
    }
});

// ---------------------------------------------------------
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

client.login(process.env.DISCORD_TOKEN);