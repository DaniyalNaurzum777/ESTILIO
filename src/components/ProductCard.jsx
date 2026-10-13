
function ProductCard({ product, selectedSize, onSizeChange, onAddToCart, formatPrice }) {
  return (
    <article className="product">
      <img src={product.image} alt={product.name} />

      <h3>{product.name}</h3>
      <p>{product.category}</p>
      <strong>{formatPrice(product.price)}</strong>

      <div className="product-actions">
        <select
          value={selectedSize}
          onChange={(event) => onSizeChange(event.target.value)}
          aria-label={`Размер ${product.name}`}
        >
          <option value="M">M</option>
          <option value="L">L</option>
          <option value="XL">XL</option>
        </select>

        <button type="button" onClick={onAddToCart}>
          В корзину +
        </button>
      </div>
    </article>
  )
}

export default ProductCard
