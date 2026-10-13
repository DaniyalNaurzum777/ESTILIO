
import { useState } from 'react'

function Cart({
  cartOpen,
  cart,
  cartTotal,
  formatPrice,
  onClose,
  onChangeQuantity,
  onRemoveItem,
  onOrderComplete,
}) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!cartOpen) {
    return null
  }

  async function handleCheckout(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (cart.length === 0) {
      setError('Сначала добавь товар в корзину.')
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName,
          customerPhone,
          items: cart.map((item) => ({
            id: item.id,
            size: item.size,
            quantity: item.quantity,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось оформить заказ')
      }

      setSuccess(
        `Заказ №${data.order.id} успешно оформлен! Сумма: ${formatPrice(data.order.total_price)}.`
      )

      onOrderComplete()
    } catch (err) {
      setError(
        err.message || 'Ошибка соединения. Проверь, работает ли сервер.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="cart-overlay" onClick={onClose}>
      <section
        className="cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-heading">
          <h2>Твоя корзина</h2>

          <button
            type="button"
            className="close-button"
            aria-label="Закрыть корзину"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {success && (
          <p className="checkout-success" role="status">
            {success}
          </p>
        )}

        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}

        {cart.length === 0 ? (
          <p className="empty-cart">Корзина пока пуста.</p>
        ) : (
          <div className="cart-items">
            {cart.map((item) => (
              <div
                className="cart-item"
                key={`${item.id}-${item.size}`}
              >
                <img src={item.image} alt={item.name} />

                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <p>Размер: {item.size}</p>
                  <p>{formatPrice(item.price)}</p>

                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeQuantity(item.id, item.size, -1)
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      type="button"
                      onClick={() =>
                        onChangeQuantity(item.id, item.size, 1)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="remove-button"
                  onClick={() => onRemoveItem(item.id, item.size)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cart-footer">
          <p>
            Итого: <strong>{formatPrice(cartTotal)}</strong>
          </p>

          {cart.length > 0 && (
            <form className="checkout-form" onSubmit={handleCheckout}>
              <label className="checkout-field">
                Твоё имя
                <input
                  className="checkout-input"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  minLength={2}
                  maxLength={150}
                  placeholder="Например, Даниял"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="checkout-field">
                Номер телефона
                <input
                  className="checkout-input"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  minLength={5}
                  maxLength={40}
                  placeholder="+7 7XX XXX XX XX"
                  autoComplete="tel"
                  required
                />
              </label>

              <button
                type="submit"
                className="checkout-button"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Оформляем заказ...'
                  : 'Оформить заказ'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}

export default Cart
