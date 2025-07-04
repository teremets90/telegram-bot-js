import { initDb, saveUser } from './db.js';
import 'dotenv/config';
import { Telegraf, Markup, session } from 'telegraf';

const MANAGER_ID = 339301507;
const bot = new Telegraf(process.env.BOT_TOKEN);

async function main() {
  await initDb(); // инициализация таблицы

  bot.use(session());

  // /start — приветствие и кнопка "Начать"
  bot.start((ctx) => {
    ctx.session = {}; // сбрасываем сессию при старте
    ctx.reply(
      '👋 Привет! Я — NOSH Guide бот.\n\nЯ помогу тебе получить доступ к платформе и расскажу, как всё работает.',
      Markup.keyboard([['Начать']]).resize()
    );
  });

  // Обработка кнопки "Начать"
  bot.hears('Начать', (ctx) => {
    ctx.reply(
      'NOSH Guide — это твой персональный помощник по питанию.\n\nПеред входом тебе нужно пройти короткий онбординг.',
      Markup.keyboard([['Далее']]).resize()
    );
  });

  // Обработка кнопки "Далее"
  bot.hears('Далее', (ctx) => {
    ctx.reply(
      'Как тебя зовут? Пожалуйста, введи своё имя:',
      Markup.removeKeyboard()
    );
    ctx.session.waitingForName = true;
  });

  // Обработка ввода имени и меню
  bot.on('text', async (ctx, next) => {
    if (ctx.session.waitingForName) {
      ctx.session.name = ctx.message.text;
      ctx.session.waitingForName = false;
      ctx.reply(
        `Спасибо, ${ctx.session.name}!\n\nТеперь поделись, пожалуйста, своим номером телефона:`,
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Поделиться телефоном')]
        ]).resize()
      );
    } else if (ctx.session.waitingForMenuLink) {
      ctx.session.menuLink = ctx.message.text;
      ctx.session.waitingForMenuLink = false;

      // Отправка менеджеру
      const userDataMsg = `
Новый пользователь оформляет доступ:
👤 Имя: ${ctx.session.name || '-'}
📱 Телефон: ${ctx.session.phone || '-'}
🔗 Меню: ${ctx.session.menuLink}
🆔 Telegram ID: ${ctx.from.id}
      `;
      ctx.telegram.sendMessage(MANAGER_ID, userDataMsg);

      await saveUser({
        telegram_id: ctx.from.id,
        name: ctx.session.name,
        phone: ctx.session.phone,
        menu_link: ctx.session.menuLink,
        agreed: false,
        payment_status: 'pending'
      });

      ctx.reply(
        'Спасибо! Нажимая кнопку ниже, ты соглашаешься с офертой и политикой обработки данных.',
        Markup.keyboard([['✅ Согласен']]).resize()
      );
    } else {
      return next();
    }
  });

  // Обработка контакта (телефона)
  bot.on('contact', (ctx) => {
    const phone = ctx.message.contact.phone_number;
    ctx.session.phone = phone;
    ctx.reply(
      'Спасибо! Теперь зарегистрируйся в нашем приложении по ссылке:\nhttps://app.nosh.guide/ru/login'
    ).then(() => {
      ctx.reply(
        'После регистрации, пожалуйста, пришли сюда ссылку на созданное меню.'
      );
      ctx.session.waitingForMenuLink = true;
    });
  });

  // Обработка согласия с офертой
  bot.hears('✅ Согласен', (ctx) => {
    ctx.session.agreed = true;
    ctx.reply(
      'Доступ к платформе NOSH Guide — 99 ₽/мес\nАвтоматическое продление включено.',
      Markup.keyboard([['Оплатить 99 ₽']]).resize()
    );
  });

  // Обработка кнопки "Оплатить 99 ₽"
  bot.hears('Оплатить 99 ₽', (ctx) => {
    // Здесь будет генерация ссылки на Best2Pay (пока просто заглушка)
    const paymentUrl = 'https://best2pay.ru/demo-payment-link'; // TODO: заменить на реальную ссылку
    ctx.reply(
      `Для оплаты перейди по ссылке:\n${paymentUrl}\n\nПосле оплаты доступ будет открыт автоматически.`,
      Markup.removeKeyboard()
    );
  });

  // Логирование, но с next()
  bot.on('message', (ctx, next) => {
    console.log('Получено сообщение:', ctx.message);
    return next();
  });

  // Запуск бота
  await bot.launch();
  console.log('Бот запущен!');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main();
