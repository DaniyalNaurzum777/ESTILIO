
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const app = express()
const PORT = Number(process.env.PORT) || 3000

// ========================================
// ПОДКЛЮЧЕНИЕ К POSTGRESQL
// ========================================

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
const JWT_SECRET = process.env.JWT_SECRET

app.use(cors())
app.use(express.json({ limit: '100kb' }))

// ========================================
// ПРОВЕРКА СЕРВЕРА
// ========================================

app.get('/', (req, res) => {
  res.send('ESTILIO API работает!')
})

// ========================================
// АВТОРИЗАЦИЯ АДМИНИСТРАТОРА
// ========================================

function requireAdmin(req, res, next) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    return res.status(500).json({
      error: 'Не настроены данные администратора в .env',
    })
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Необходим вход администратора',
    })
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET)

    if (
      payload.role !== 'admin' ||
      payload.username !== ADMIN_USERNAME
    ) {
      return res.status(403).json({
        error: 'Недостаточно прав',
      })
    }

    req.admin = payload
    next()
  } catch {
    return res.status(401).json({
      error: 'Токен истёк или недействителен. Войди снова.',
    })
  }
}

// ========================================
// 1. ВХОД АДМИНИСТРАТОРА
// ========================================

app.post('/api/admin/login', async (req, res) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    return res.status(500).json({
      error: 'Не настроены данные администратора в .env',
    })
  }

  const { username, password } = req.body || {}

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > 150 ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: 'Введи корректные логин и пароль',
    })
  }

  try {
    const passwordMatches = await bcrypt.compare(
      password,
      ADMIN_PASSWORD_HASH
    )

    if (username !== ADMIN_USERNAME || !passwordMatches) {
      return res.status(401).json({
        error: 'Неверный логин или пароль',
      })
    }

    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: 'admin',
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    )

    res.json({
      message: 'Вход выполнен успешно',
      token,
      expiresIn: 7200,
    })
  } catch (error) {
    console.error('Ошибка входа:', error.message)

    res.status(500).json({
      error: 'Ошибка авторизации',
    })
  }
})

// ========================================
// 2. ПОЛУЧЕНИЕ ТОВАРОВ ДЛЯ МАГАЗИНА
// ========================================

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, price, image
       FROM products
       ORDER BY id`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error.message)

    res.status(500).json({
      error: 'Не удалось загрузить товары',
    })
  }
})

// ========================================
// 3. ОФОРМЛЕНИЕ ЗАКАЗА
// ========================================

app.post('/api/orders', async (req, res) => {
  const { customerName, customerPhone, items } = req.body || {}

  if (
    typeof customerName !== 'string' ||
    customerName.trim().length < 2 ||
    customerName.trim().length > 150
  ) {
    return res.status(400).json({
      error: 'Укажи имя покупателя',
    })
  }

  if (
    typeof customerPhone !== 'string' ||
    customerPhone.trim().length < 5 ||
    customerPhone.trim().length > 40
  ) {
    return res.status(400).json({
      error: 'Укажи корректный номер телефона',
    })
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100
  ) {
    return res.status(400).json({
      error: 'В заказе должны быть товары',
    })
  }

  const validSizes = ['M', 'L', 'XL']

  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      !validSizes.includes(item.size) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100
    ) {
      return res.status(400).json({
        error: 'Проверь товары, размеры и количество',
      })
    }
  }

  let client

  try {
    client = await pool.connect()
    await client.query('BEGIN')

    // Получаем реальные цены из базы данных
    const productIds = [...new Set(items.map((item) => item.id))]

    const result = await client.query(
      `SELECT id, name, price
       FROM products
       WHERE id = ANY($1::int[])`,
      [productIds]
    )

    const productsById = new Map(
      result.rows.map((product) => [product.id, product])
    )

    if (productIds.some((id) => !productsById.has(id))) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        error: 'Один или несколько товаров не найдены',
      })
    }

    const orderItems = items.map((item) => ({
      ...item,
      product: productsById.get(item.id),
    }))

    const totalPrice = orderItems.reduce(
      (total, item) =>
        total + item.product.price * item.quantity,
      0
    )

    if (
      !Number.isSafeInteger(totalPrice) ||
      totalPrice < 0 ||
      totalPrice > 2147483647
    ) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        error: 'Недопустимая сумма заказа',
      })
    }

    const orderResult = await client.query(
      `INSERT INTO orders
        (customer_name, customer_phone, total_price)
       VALUES ($1, $2, $3)
       RETURNING id, customer_name, customer_phone,
                 total_price, status, created_at`,
      [customerName.trim(), customerPhone.trim(), totalPrice]
    )

    const order = orderResult.rows[0]

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items
          (order_id, product_id, product_name, size, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.product.id,
          item.product.name,
          item.size,
          item.product.price,
          item.quantity,
        ]
      )
    }

    await client.query('COMMIT')

    res.status(201).json({
      message: 'Заказ успешно создан',
      order,
    })
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Ошибка отмены:', rollbackError.message)
      }
    }

    console.error('Ошибка создания заказа:', error.message)

    res.status(500).json({
      error: 'Не удалось создать заказ',
    })
  } finally {
    if (client) {
      client.release()
    }
  }
})

// ========================================
// 4. ПРОСМОТР ЗАКАЗОВ АДМИНИСТРАТОРОМ
// ========================================

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.customer_name,
        o.customer_phone,
        o.total_price,
        o.status,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'product_name', oi.product_name,
              'size', oi.size,
              'unit_price', oi.unit_price,
              'quantity', oi.quantity
            )
            ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `)

    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error.message)

    res.status(500).json({
      error: 'Не удалось загрузить заказы',
    })
  }
})

// ========================================
// 5. ИЗМЕНЕНИЕ СТАТУСА ЗАКАЗА
// ========================================

app.patch(
  '/api/admin/orders/:id/status',
  requireAdmin,
  async (req, res) => {
    const orderId = Number(req.params.id)
    const { status } = req.body || {}

    const allowedStatuses = [
      'new',
      'processing',
      'shipped',
      'completed',
      'cancelled',
    ]

    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      return res.status(400).json({
        error: 'Неверный номер заказа',
      })
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Недопустимый статус заказа',
      })
    }

    try {
      const result = await pool.query(
        `UPDATE orders
         SET status = $1
         WHERE id = $2
         RETURNING id, status`,
        [status, orderId]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Заказ не найден',
        })
      }

      res.json({
        message: 'Статус заказа обновлён',
        order: result.rows[0],
      })
    } catch (error) {
      console.error('Ошибка изменения статуса:', error.message)

      res.status(500).json({
        error: 'Не удалось изменить статус заказа',
      })
    }
  }
)

// ========================================
// 6. ПРОВЕРКА ДАННЫХ ТОВАРА
// ========================================

function validateProduct(body) {
  if (
    !body ||
    typeof body.name !== 'string' ||
    body.name.trim().length < 2 ||
    body.name.trim().length > 150
  ) {
    return 'Название должно содержать от 2 до 150 символов'
  }

  if (
    typeof body.category !== 'string' ||
    body.category.trim().length < 2 ||
    body.category.trim().length > 100
  ) {
    return 'Укажи корректную категорию товара'
  }

  if (
    !Number.isSafeInteger(body.price) ||
    body.price < 0 ||
    body.price > 2147483647
  ) {
    return 'Цена должна быть целым неотрицательным числом'
  }

  if (
    typeof body.image !== 'string' ||
    body.image.trim().length === 0 ||
    body.image.length > 2000
  ) {
    return 'Укажи ссылку на фотографию'
  }

  try {
    const imageUrl = new URL(body.image.trim())

    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
      return 'Ссылка должна использовать HTTP или HTTPS'
    }
  } catch {
    return 'Ссылка на фотографию некорректна'
  }

  return null
}

// ========================================
// 7. ПОЛУЧЕНИЕ ТОВАРОВ В АДМИНКЕ
// ========================================

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, price, image
       FROM products
       ORDER BY id`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error.message)

    res.status(500).json({
      error: 'Не удалось загрузить товары',
    })
  }
})

// ========================================
// 8. ДОБАВЛЕНИЕ ТОВАРА
// ========================================

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const validationError = validateProduct(req.body)

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    })
  }

  const { name, category, price, image } = req.body

  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, price, image)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, category, price, image`,
      [name.trim(), category.trim(), price, image.trim()]
    )

    res.status(201).json({
      message: 'Товар добавлен',
      product: result.rows[0],
    })
  } catch (error) {
    console.error('Ошибка добавления товара:', error.message)

    res.status(500).json({
      error: 'Не удалось добавить товар',
    })
  }
})

// ========================================
// 9. РЕДАКТИРОВАНИЕ ТОВАРА
// ========================================

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const productId = Number(req.params.id)
  const validationError = validateProduct(req.body)

  if (!Number.isSafeInteger(productId) || productId < 1) {
    return res.status(400).json({
      error: 'Неверный номер товара',
    })
  }

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    })
  }

  const { name, category, price, image } = req.body

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           category = $2,
           price = $3,
           image = $4
       WHERE id = $5
       RETURNING id, name, category, price, image`,
      [name.trim(), category.trim(), price, image.trim(), productId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Товар не найден',
      })
    }

    res.json({
      message: 'Товар обновлён',
      product: result.rows[0],
    })
  } catch (error) {
    console.error('Ошибка редактирования товара:', error.message)

    res.status(500).json({
      error: 'Не удалось обновить товар',
    })
  }
})

// ========================================
// 10. УДАЛЕНИЕ ТОВАРА
// ========================================

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const productId = Number(req.params.id)

  if (!Number.isSafeInteger(productId) || productId < 1) {
    return res.status(400).json({
      error: 'Неверный номер товара',
    })
  }

  try {
    const result = await pool.query(
      `DELETE FROM products
       WHERE id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM order_items
           WHERE product_id = $1
         )
       RETURNING id`,
      [productId]
    )

    if (result.rowCount === 0) {
      const existing = await pool.query(
        'SELECT id FROM products WHERE id = $1',
        [productId]
      )

      if (existing.rowCount === 0) {
        return res.status(404).json({
          error: 'Товар не найден',
        })
      }

      return res.status(409).json({
        error: 'Нельзя удалить товар, который уже входит в заказы',
      })
    }

    res.json({
      message: 'Товар удалён',
      id: productId,
    })
  } catch (error) {
    console.error('Ошибка удаления товара:', error.message)

    res.status(500).json({
      error: 'Не удалось удалить товар',
    })
  }
})

// ========================================
// 11. НЕИЗВЕСТНЫЕ МАРШРУТЫ
// ========================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден',
  })
})

// ========================================
// ЗАПУСК СЕРВЕРА
// ========================================

app.listen(PORT, () => {
  console.log(`ESTILIO API запущен: http://localhost:${PORT}`)
})
