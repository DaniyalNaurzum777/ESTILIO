
import { useState, useEffect } from 'react'
import '../App.css'

import Header from '../components/Header.jsx'
import ProductCard from '../components/ProductCard.jsx'
import Cart from '../components/Cart.jsx'
import Admin from '../components/Admin.jsx'

function formatPrice(price) {
  return Number(price).toLocaleString('ru-RU') + ' ₸'
}

function App() {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState('')

  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('estilioCart')
      return savedCart ? JSON.parse(savedCart) : []
    } catch {
      return []
    }
  })

  const [cartOpen, setCartOpen] = useState(false)

  const [selectedSizes, setSelectedSizes] = useState({
    1: 'M',
    2: 'M',
    3: 'M',
  })

  // Загружаем товары с сервера
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/products'
        )

        if (!response.ok) {
          throw new Error('Не удалось загрузить товары')
        }

        const data = await response.json()

        if (!Array.isArray(data)) {
          throw new Error('Неверный формат каталога')
        }

        setProducts(data)
        setProductsError('')
      } catch (error) {
        console.error('Ошибка загрузки товаров:', error)

        setProductsError(
          'Не удалось загрузить товары. Проверь, работает ли сервер.'
        )
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [])

  // Сохраняем корзину в браузере
  useEffect(() => {
    try {
      localStorage.setItem('estilioCart', JSON.stringify(cart))
    } catch (error) {
      console.error('Не удалось сохранить корзину:', error)
    }
  }, [cart])

  // Закрытие корзины клавишей Escape
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setCartOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Добавление товара в корзину
  function addToCart(product) {
    const size = selectedSizes[product.id] || 'M'

    setCart((previousCart) => {
      const existing = previousCart.find(
        (item) => item.id === product.id && item.size === size
      )

      if (existing) {
        return previousCart.map((item) =>
          item.id === product.id && item.size === size
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      }

      return [
        ...previousCart,
        {
          ...product,
          size,
          quantity: 1,
        },
      ]
    })

    setCartOpen(true)
  }

  // Изменение количества товара
  function changeQuantity(id, size, amount) {
    setCart((previousCart) =>
      previousCart
        .map((item) =>
          item.id === id && item.size === size
            ? {
                ...item,
                quantity: item.quantity + amount,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  // Удаление позиции из корзины
  function removeItem(id, size) {
    setCart((previousCart) =>
      previousCart.filter(
        (item) => !(item.id === id && item.size === size)
      )
    )
  }

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  // Административная страница
  if (window.location.pathname === '/admin') {
    return <Admin />
  }

  return (
    <div className="store">
      <Header
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
      />

      <main>
        {/* Главный экран */}
        <section className="hero">
          <p className="eyebrow">ESTILIO — NEW COLLECTION</p>

          <h1>Built for more.</h1>

          <p className="hero-description">
            Минимализм. Комфорт. Твой путь.
            <br />
            Одежда для тех, кто стремится к большему.
          </p>

          <a href="#catalog" className="hero-button">
            Смотреть коллекцию
          </a>
        </section>

        {/* Каталог */}
        <section className="catalog" id="catalog">
          <p className="eyebrow">ESTILIO STORE</p>

          <h2>Новая коллекция</h2>

          {loadingProducts && (
            <p className="catalog-message">
              Загружаем товары...
            </p>
          )}

          {productsError && (
            <p className="checkout-error" role="alert">
              {productsError}
            </p>
          )}

          {!loadingProducts &&
            !productsError &&
            products.length === 0 && (
              <p className="catalog-message">
                Пока нет товаров.
              </p>
            )}

          <div className="products">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedSize={selectedSizes[product.id] || 'M'}
                onSizeChange={(size) =>
                  setSelectedSizes((previousSizes) => ({
                    ...previousSizes,
                    [product.id]: size,
                  }))
                }
                onAddToCart={() => addToCart(product)}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        </section>

        {/* О бренде */}
        <section className="about" id="about">
          <p className="eyebrow">OUR PHILOSOPHY</p>

          <h2>Больше, чем одежда.</h2>

          <p>
            ESTILIO — минимализм, свобода и стремление к большему.
            <br />
            Каждый день — новый шаг на пути к своей мечте.
          </p>
        </section>
      </main>

      {/* Подвал */}
      <footer className="site-footer">
        <a href="#" className="logo">
          EST<span>ILIO</span>
        </a>

        <p>© 2026 ESTILIO. Все права защищены.</p>
      </footer>

      {/* Корзина и оформление заказа */}
      <Cart
        cartOpen={cartOpen}
        cart={cart}
        cartTotal={cartTotal}
        formatPrice={formatPrice}
        onClose={() => setCartOpen(false)}
        onChangeQuantity={changeQuantity}
        onRemoveItem={removeItem}
        onOrderComplete={() => setCart([])}
      />
    </div>
  )
}

export default App
