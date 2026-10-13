
function Header({ cartCount, onCartOpen }) {
  return (
    <header className="header">
      <a href="#" className="logo">
        EST<span>ILIO</span>
      </a>

      <nav>
        <a href="#catalog">Каталог</a>
        <a href="#about">О бренде</a>
      </nav>

      <button
        type="button"
        className="cart-button"
        onClick={onCartOpen}
      >
        Корзина ({cartCount})
      </button>
    </header>
  )
}

export default Header
