
import { useCallback, useEffect, useState } from 'react'

function formatPrice(price) {
  return Number(price).toLocaleString('ru-RU') + ' ₸'
}

function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU')
}

const statusLabels = {
  new: 'Новый',
  processing: 'В обработке',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const emptyProduct = {
  name: '',
  category: '',
  price: '',
  image: '',
}

function Admin() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('estilioAdminToken') || ''
  )

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])

  const [loginError, setLoginError] = useState('')
  const [ordersError, setOrdersError] = useState('')
  const [productsError, setProductsError] = useState('')
  const [notice, setNotice] = useState('')

  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(null)

  const [activeTab, setActiveTab] = useState('orders')
  const [editingProductId, setEditingProductId] = useState(null)
  const [productForm, setProductForm] = useState(emptyProduct)

  // Вход администратора
  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')
    setLoadingLogin(true)

    try {
      const response = await fetch(
        'http://localhost:3000/api/admin/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось войти')
      }

      if (!data.token) {
        throw new Error('Сервер не вернул токен авторизации')
      }

      sessionStorage.setItem('estilioAdminToken', data.token)
      setToken(data.token)
      setPassword('')
      setLoginError('')
    } catch (error) {
      setLoginError(
        error.message || 'Не удалось подключиться к серверу'
      )
    } finally {
      setLoadingLogin(false)
    }
  }

  // Выход администратора
  function handleLogout() {
    sessionStorage.removeItem('estilioAdminToken')
    setToken('')
    setOrders([])
    setProducts([])
    setPassword('')
    setLoginError('')
    setOrdersError('')
    setProductsError('')
    setNotice('')
  }

  // Загрузка заказов
  const loadOrders = useCallback(async () => {
    if (!token) return

    setLoadingOrders(true)
    setOrdersError('')

    try {
      const response = await fetch(
        'http://localhost:3000/api/admin/orders',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout()
        }

        throw new Error(data.error || 'Не удалось загрузить заказы')
      }

      if (!Array.isArray(data)) {
        throw new Error('Неверный формат списка заказов')
      }

      setOrders(data)
    } catch (error) {
      setOrdersError(
        error.message || 'Ошибка загрузки заказов'
      )
    } finally {
      setLoadingOrders(false)
    }
  }, [token])

  // Загрузка товаров
  const loadProducts = useCallback(async () => {
    if (!token) return

    setLoadingProducts(true)
    setProductsError('')

    try {
      const response = await fetch(
        'http://localhost:3000/api/admin/products',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout()
        }

        throw new Error(data.error || 'Не удалось загрузить товары')
      }

      if (!Array.isArray(data)) {
        throw new Error('Неверный формат списка товаров')
      }

      setProducts(data)
    } catch (error) {
      setProductsError(
        error.message || 'Ошибка загрузки товаров'
      )
    } finally {
      setLoadingProducts(false)
    }
  }, [token])

  // После входа загружаем данные
  useEffect(() => {
    if (token) {
      loadOrders()
      loadProducts()
    }
  }, [token, loadOrders, loadProducts])

  // Изменение статуса заказа
  async function handleStatusChange(orderId, newStatus) {
    setOrdersError('')
    setNotice('')
    setUpdatingOrder(orderId)

    try {
      const response = await fetch(
        `http://localhost:3000/api/admin/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout()
        }

        throw new Error(data.error || 'Не удалось изменить статус')
      }

      setOrders((previousOrders) =>
        previousOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: data.order.status }
            : order
        )
      )

      setNotice(`Статус заказа №${orderId} обновлён.`)
    } catch (error) {
      setOrdersError(
        error.message || 'Ошибка обновления статуса'
      )
    } finally {
      setUpdatingOrder(null)
    }
  }

  // Начинаем редактирование товара
  function startEditingProduct(product) {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      image: product.image,
    })
    setProductsError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Отмена редактирования
  function cancelEditingProduct() {
    setEditingProductId(null)
    setProductForm({ ...emptyProduct })
    setProductsError('')
    setNotice('')
  }

  // Добавление или сохранение изменений товара
  async function handleProductSubmit(event) {
    event.preventDefault()
    setProductsError('')
    setNotice('')

    const price = Number(productForm.price)

    if (!Number.isSafeInteger(price) || price < 0) {
      setProductsError('Цена должна быть целым числом не меньше нуля.')
      return
    }

    const payload = {
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      price,
      image: productForm.image.trim(),
    }

    setSavingProduct(true)

    try {
      const isEditing = editingProductId !== null
      const url = isEditing
        ? `http://localhost:3000/api/admin/products/${editingProductId}`
        : 'http://localhost:3000/api/admin/products'

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout()
        }

        throw new Error(data.error || 'Не удалось сохранить товар')
      }

      setNotice(
        isEditing
          ? 'Изменения товара сохранены.'
          : 'Новый товар добавлен в каталог.'
      )

      setEditingProductId(null)
      setProductForm({ ...emptyProduct })

      await loadProducts()
    } catch (error) {
      setProductsError(
        error.message || 'Ошибка сохранения товара'
      )
    } finally {
      setSavingProduct(false)
    }
  }

  // Удаление товара
  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(
      `Удалить товар «${product.name}»?`
    )

    if (!confirmed) return

    setProductsError('')
    setNotice('')
    setDeletingProduct(product.id)

    try {
      const response = await fetch(
        `http://localhost:3000/api/admin/products/${product.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout()
        }

        throw new Error(data.error || 'Не удалось удалить товар')
      }

      if (editingProductId === product.id) {
        cancelEditingProduct()
      }

      setNotice(`Товар «${product.name}» удалён.`)
      await loadProducts()
    } catch (error) {
      setProductsError(
        error.message || 'Ошибка удаления товара'
      )
    } finally {
      setDeletingProduct(null)
    }
  }

  const totalRevenue = orders.reduce(
    (total, order) => total + Number(order.total_price),
    0
  )

  const newOrders = orders.filter(
    (order) => order.status === 'new'
  ).length

  // Форма входа
  if (!token) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <a href="/" className="logo">
            EST<span>ILIO</span>
          </a>

          <p className="eyebrow">ESTILIO MANAGEMENT</p>
          <h1>Вход администратора</h1>

          <p className="admin-login-description">
            Войди, чтобы управлять заказами и каталогом.
          </p>

          {loginError && (
            <div className="admin-error" role="alert">
              {loginError}
            </div>
          )}

          <label className="admin-login-field">
            Логин
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="admin-login-field">
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            className="admin-login-button"
            disabled={loadingLogin}
          >
            {loadingLogin ? 'Проверяем...' : 'Войти'}
          </button>

          <a href="/" className="admin-login-back">
            ← Вернуться в магазин
          </a>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" className="logo">
          EST<span>ILIO</span>
        </a>

        <div className="admin-header-actions">
          <a href="/" className="admin-back">
            ← Вернуться в магазин
          </a>

          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
          >
            Выйти
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow">ESTILIO MANAGEMENT</p>
            <h1>
              {activeTab === 'orders' ? 'Заказы' : 'Товары'}
            </h1>
            <p className="admin-subtitle">
              Управление интернет-магазином ESTILIO.
            </p>
          </div>

          <button
            className="admin-refresh"
            type="button"
            onClick={() => {
              if (activeTab === 'orders') {
                loadOrders()
              } else {
                loadProducts()
              }
              setNotice('')
            }}
            disabled={loadingOrders || loadingProducts}
          >
            {loadingOrders || loadingProducts
              ? 'Загрузка...'
              : 'Обновить'}
          </button>
        </div>

        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('orders')
              setNotice('')
            }}
          >
            Заказы ({orders.length})
          </button>

          <button
            type="button"
            className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('products')
              setNotice('')
            }}
          >
            Товары ({products.length})
          </button>
        </div>

        {notice && (
          <div className="admin-notice" role="status">
            {notice}
          </div>
        )}

        {/* ВКЛАДКА ЗАКАЗОВ */}
        {activeTab === 'orders' && (
          <>
            <div className="admin-stats">
              <div className="admin-stat">
                <span>Всего заказов</span>
                <strong>{orders.length}</strong>
              </div>

              <div className="admin-stat">
                <span>Новые заказы</span>
                <strong>{newOrders}</strong>
              </div>

              <div className="admin-stat">
                <span>Сумма всех заказов</span>
                <strong>{formatPrice(totalRevenue)}</strong>
              </div>
            </div>

            {ordersError && (
              <div className="admin-error" role="alert">
                {ordersError}
              </div>
            )}

            {loadingOrders && orders.length === 0 && !ordersError && (
              <p className="admin-message">Загружаем заказы...</p>
            )}

            {!loadingOrders && !ordersError && orders.length === 0 && (
              <p className="admin-message">Пока заказов нет.</p>
            )}

            {orders.length > 0 && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Заказ</th>
                      <th>Покупатель</th>
                      <th>Товары</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>#{order.id}</strong>
                        </td>

                        <td>
                          <strong>{order.customer_name}</strong>
                          <a
                            className="admin-phone"
                            href={`tel:${order.customer_phone}`}
                          >
                            {order.customer_phone}
                          </a>
                        </td>

                        <td>
                          <div className="admin-items">
                            {(Array.isArray(order.items) ? order.items : []).map(
                              (item, index) => (
                                <div
                                  key={`${order.id}-${index}`}
                                  className="admin-item"
                                >
                                  {item.product_name} · {item.size} ·{' '}
                                  {item.quantity} шт.
                                </div>
                              )
                            )}
                          </div>
                        </td>

                        <td>
                          <strong>{formatPrice(order.total_price)}</strong>
                        </td>

                        <td>
                          <select
                            className="admin-status-select"
                            value={order.status}
                            disabled={updatingOrder === order.id}
                            onChange={(event) =>
                              handleStatusChange(
                                order.id,
                                event.target.value
                              )
                            }
                            aria-label={`Статус заказа ${order.id}`}
                          >
                            {Object.entries(statusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>

                          {updatingOrder === order.id && (
                            <small className="admin-saving">
                              Сохраняем...
                            </small>
                          )}
                        </td>

                        <td className="admin-date">
                          {formatDate(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ВКЛАДКА ТОВАРОВ */}
        {activeTab === 'products' && (
          <>
            {productsError && (
              <div className="admin-error" role="alert">
                {productsError}
              </div>
            )}

            <section className="admin-product-form-section">
              <h2>
                {editingProductId
                  ? `Редактирование товара №${editingProductId}`
                  : 'Добавить товар'}
              </h2>

              <form
                className="admin-product-form"
                onSubmit={handleProductSubmit}
              >
                <label>
                  Название
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    minLength={2}
                    maxLength={150}
                    placeholder="Например, Essential White Tee"
                    required
                  />
                </label>

                <label>
                  Категория
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(event) =>
                      setProductForm((previous) => ({
                        ...previous,
                        category: event.target.value,
                      }))
                    }
                    minLength={2}
                    maxLength={100}
                    placeholder="Футболка"
                    required
                  />
                </label>

                <label>
                  Цена в тенге
                  <input
                    type="number"
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm((previous) => ({
                        ...previous,
                        price: event.target.value,
                      }))
                    }
                    min="0"
                    max="2147483647"
                    step="1"
                    placeholder="7990"
                    required
                  />
                </label>

                <label className="admin-product-image-field">
                  URL фотографии
                  <input
                    type="url"
                    value={productForm.image}
                    onChange={(event) =>
                      setProductForm((previous) => ({
                        ...previous,
                        image: event.target.value,
                      }))
                    }
                    maxLength={2000}
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                </label>

                <div className="admin-product-form-actions">
                  <button
                    type="submit"
                    className="admin-product-save"
                    disabled={savingProduct}
                  >
                    {savingProduct
                      ? 'Сохраняем...'
                      : editingProductId
                        ? 'Сохранить изменения'
                        : 'Добавить товар'}
                  </button>

                  {editingProductId !== null && (
                    <button
                      type="button"
                      className="admin-product-cancel"
                      onClick={cancelEditingProduct}
                      disabled={savingProduct}
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </form>
            </section>

            <div className="admin-products-heading">
              <h2>Каталог товаров</h2>
              <span>{products.length} товаров</span>
            </div>

            {loadingProducts && products.length === 0 && (
              <p className="admin-message">Загружаем товары...</p>
            )}

            {!loadingProducts && products.length === 0 && !productsError && (
              <p className="admin-message">В каталоге пока нет товаров.</p>
            )}

            {products.length > 0 && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Фотография</th>
                      <th>Название</th>
                      <th>Категория</th>
                      <th>Цена</th>
                      <th>Действия</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>{product.id}</td>

                        <td>
                          <img
                            className="admin-product-thumbnail"
                            src={product.image}
                            alt={product.name}
                          />
                        </td>

                        <td>
                          <strong>{product.name}</strong>
                        </td>

                        <td>{product.category}</td>

                        <td>
                          <strong>{formatPrice(product.price)}</strong>
                        </td>

                        <td>
                          <div className="admin-product-actions">
                            <button
                              type="button"
                              className="admin-product-edit"
                              onClick={() => startEditingProduct(product)}
                            >
                              Изменить
                            </button>

                            <button
                              type="button"
                              className="admin-product-delete"
                              onClick={() => handleDeleteProduct(product)}
                              disabled={deletingProduct === product.id}
                            >
                              {deletingProduct === product.id
                                ? 'Удаляем...'
                                : 'Удалить'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default Admin
