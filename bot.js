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
      'NOSH Guide — это AI-платформа для ресторанного бизнеса, повышающая выручку и лояльность гостей с помощью персонализированных рекомендаций, видео-меню, отзывов и глубокой аналитики.\n\nПеред входом тебе нужно пройти короткий онбординг.',
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
    } else if (ctx.session.onboardingStep === 'wait_menu_link') {
      ctx.session.menuLink = ctx.message.text;
      ctx.session.onboardingStep = undefined;

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
        'Спасибо! Нажимая кнопку ниже, ты соглашаешься с <a href="https://nosh.guide/docs/terms_of_use">пользовательским соглашением</a> и <a href="https://nosh.guide/docs/privacy_policy">политикой обработки данных</a>.',
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([['✅ Согласен']]).resize()
        }
      );
    } else {
      return next();
    }
  });

  // Обработка контакта (телефона)
  bot.on('contact', (ctx) => {
    const phone = ctx.message.contact.phone_number;
    ctx.session.phone = phone;
    ctx.replyWithVideo(
        { source: './videos/registration.mp4' },
        { caption: 'Спасибо! Теперь зарегистрируйся в нашем приложении по ссылке:\nhttps://app.nosh.guide/ru/login' }
    ).then(() => {
      ctx.session.onboardingStep = 'wait_registration_confirm';
      ctx.reply(
        '✅ После регистрации аккаунта нажми кнопку ниже, чтобы перейти к следующему этапу.',
        Markup.keyboard([['Я зарегистрировался']]).resize()
      );
    });
  });

  // Новый этап: подтверждение регистрации и видеоинструкция по созданию меню
  bot.hears('Я зарегистрировался', (ctx) => {
    ctx.session.onboardingStep = 'wait_menu_video';
    ctx.replyWithVideo(
      { source: './videos/create_menu.mp4' }, // Путь к видеофайлу на сервере
      { caption: 'Посмотри видеоинструкцию, как создать меню в приложении.' }
    ).then(() => {
      ctx.session.onboardingStep = 'wait_menu_created';
      ctx.reply(
        'Когда меню будет готово, нажми кнопку ниже.',
        Markup.keyboard([['Я создал меню']]).resize()
      );
    });
  });

  // Новый этап: подтверждение создания меню и видео о получении ссылки
  bot.hears('Я создал меню', (ctx) => {
    ctx.session.onboardingStep = 'wait_menu_link';
    ctx.replyWithVideo(
      { source: './videos/get_menu_link.mp4' }, // Путь к видеофайлу на сервере
      { caption: 'Видео: как получить ссылку на меню.' }
    ).then(() => {
      ctx.reply(
        'Пожалуйста, пришли сюда ссылку на своё меню.',
        Markup.removeKeyboard()
      );
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
