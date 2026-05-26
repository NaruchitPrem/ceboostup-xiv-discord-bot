require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
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
const staffDoc = new GoogleSpreadsheet(process.env.STAFF_SHEET_ID, serviceAccountAuth);

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

// =================================================================
// 🎮 ระบบเมื่อคนกดปุ่ม หรือส่งฟอร์ม (รวมของน้อง และ Staff)
// =================================================================
client.on(Events.InteractionCreate, async interaction => {

    // 🔘 [ส่วนที่ 1] : ถ้าสิ่งที่เกิดขึ้นคือการ "กดปุ่ม"
    if (interaction.isButton()) {
        
        // 👶 บล็อกของ "verify น้อง" (ยกมาจากของเดิมของคุณเป๊ะๆ)
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
                        await interaction.editReply(`✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับสู่ **${houseName}** (${majorName}) ครับ!`);
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
        
        // 🛠️ บล็อกของ "verify Staff" (เปลี่ยนเป็นเด้งหน้าต่างกรอกรหัส)
        else if (interaction.customId === 'verify_staff_button') {
            const modal = new ModalBuilder()
                .setCustomId('staff_verify_modal')
                .setTitle('ยืนยันตัวตน Staff');

            const studentIdInput = new TextInputBuilder()
                .setCustomId('student_id_input')
                .setLabel('กรอกรหัสนักศึกษาของคุณ')
                .setPlaceholder('เช่น 68123456')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(8)
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(studentIdInput);
            modal.addComponents(firstActionRow);
            
            // สั่งให้บอทแสดงหน้าต่าง Pop-up เด้งขึ้นมา
            await interaction.showModal(modal);
        }
    }

// 📝 [ส่วนที่ 2] : ถ้าสิ่งที่เกิดขึ้นคือการ "กดยืนยันส่งฟอร์ม Pop-up" (Modal)
    else if (interaction.isModalSubmit()) {
        
        if (interaction.customId === 'staff_verify_modal') {
            await interaction.deferReply({ ephemeral: true });
            const studentId = interaction.fields.getTextInputValue('student_id_input').trim();

            try {
                // โหลดข้อมูลจาก Google Sheet ของสตาฟ
                await staffDoc.loadInfo();
                const sheet = staffDoc.sheetsByIndex[0];
                const rows = await sheet.getRows();

                // ค้นหาแถวที่ "รหัสนศ." ตรงกับที่กรอกมา
                const userData = rows.find(row => row.get('รหัสนศ.') === studentId);

                if (userData) {
                    const staffRoleId = process.env.STAFF_ROLE_ID;
                    const nickname = userData.get('ชื่อเล่น');
                    const position = userData.get('ตำแหน่ง');
                    
                    // 1. ดึงข้อความดิบมาจากชีท เช่น "The World (หัวหน้า)"
                    const rawHouseName = userData.get('บ้าน'); 
                    
                    // 📌 2. [แก้ไขตรงนี้] ค้นหาคีย์ใน houseRoles ว่ามีคำไหน "ซ่อนอยู่ในข้อความดิบ" ไหม
                    // เช่น ถ้า rawHouseName มีคำว่า "The World" มันจะเลือกคีย์ "The World" ให้ทันทีครับ
                    const houseName = Object.keys(houseRoles).find(key => 
                            rawHouseName && rawHouseName.toLowerCase().includes(key.toLowerCase()));
                                 
                    // 3. เอาชื่อบ้านที่ถอดวงเล็บออกแล้ว ไปดึงไอดีของยศมาใช้งาน
                    const houseRoleId = houseName ? houseRoles[houseName] : undefined; 

                    if (!staffRoleId) {
                        return await interaction.editReply(`⚠️ บอทยังไม่ได้ตั้งค่ายศ Staff ในระบบครับ`);
                    }

                    // ------------------------------------------------
                    // ระบบเปลี่ยนชื่อเล่นเป็น P'ชื่อเล่น
                    // ------------------------------------------------
                    let nicknameChanged = true;
                    try {
                        await interaction.member.setNickname(`P' ${nickname}`);
                    } catch (nickError) {
                        console.error('⚠️ เปลี่ยนชื่อเล่นไม่ได้:', nickError);
                        nicknameChanged = false; 
                    }

                    // เตรียมรายการยศที่จะแจก
                    const rolesToAdd = [];
                    if (!interaction.member.roles.cache.has(staffRoleId)) {
                        rolesToAdd.push(staffRoleId);
                    }
                    if (houseRoleId && !interaction.member.roles.cache.has(houseRoleId)) {
                        rolesToAdd.push(houseRoleId);
                    }

                    // สั่งยัดยศทั้งหมดที่มีในรายการพร้อมกัน
                    if (rolesToAdd.length > 0) {
                        await interaction.member.roles.add(rolesToAdd);
                    }

                    // สร้างข้อความตอบกลับ
                    let msg = `✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับ **P' ${nickname}** `;
                    if (houseRoleId) msg += ` บ้าน **${houseName}**`; // จะแสดงชื่อบ้านสวยๆ เช่น "The World"
                    
                    if (nicknameChanged) {
                        msg += ` บอทได้เปลี่ยนชื่อเล่นในเซิร์ฟให้เป็น **P' ${nickname}** เรียบร้อยครับ 🛠️🏠`;
                    } else {
                        msg += ` ได้รับยศเรียบร้อยครับ 🛠️🏠`;
                    }
                    
                    await interaction.editReply(msg);
                } else {
                    await interaction.editReply(`❌ ไม่พบรหัสนักศึกษา **${studentId}** ในฐานข้อมูล Staff ครับ`);
                }
            } catch (error) {
                console.error('Staff Verify Error:', error);
                await interaction.editReply(`🚨 เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet ครับ`);
            }
        }
    }
});

// ----------------------------------------------------
// ระบบต้อนรับคนเข้าเซิร์ฟเวอร์ (Welcome Message)
// ----------------------------------------------------
client.on(Events.GuildMemberAdd, async member => {
    try {
        // ดึง ID ช่องต้อนรับ และช่อง verify จากไฟล์ .env (ใช้โค้ดเดิมของคุณเลยครับ)
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        const verifyChannelId = process.env.VERIFY_CHANNEL_ID;

        if (!welcomeChannelId) return;

        const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId);

        if (welcomeChannel) {
            // สร้างกล่องข้อความ Embed (แบบมีรูปโปรไฟล์)
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#041241') // สีขอบซ้ายของกล่อง (สามารถเปลี่ยนรหัสสี HEX ได้ตามชอบ)
                .setTitle('🎉 ยินดีต้อนรับ <@${member.id}> สู่ CE BOOSTUP XIV')
                .setDescription(`ยินดีต้อนรับสู่เซิร์ฟเวอร์!\n\nอย่าลืมไปที่ช่อง <#${verifyChannelId}> เพื่อ **ยืนยันตัวตน** ด้วยนะครับ ✅`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setFooter({ text: `สมาชิกคนที่ ${member.guild.memberCount} ของเซิร์ฟเวอร์` })
                .setTimestamp();

            // ส่งข้อความ (มีการ Ping ชื่อด้านนอกกล่อง เพื่อให้แจ้งเตือนเด้งเตือนน้องๆ)
            await welcomeChannel.send({ 
                content: `🎉ยินดีต้อนรับ <@${member.id}> 👋`, 
                embeds: [welcomeEmbed] 
            });
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