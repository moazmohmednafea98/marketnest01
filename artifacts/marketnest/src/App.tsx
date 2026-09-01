import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  BarChart3, Check, CircleAlert, LayoutDashboard, Loader2, Minus, Package,
  Pencil, Plus, Search, ShoppingBag, Store, Trash2, Truck, UserRound, X,
} from 'lucide-react';
import {
  getGetAdminSummaryQueryKey, getGetProductQueryKey, getListOrdersQueryKey,
  getListProductsQueryKey, useCreateOrder, useCreateProduct, useDeleteProduct,
  useGetAdminSummary, useGetProduct, useListOrders, useListProducts,
  useUpdateOrderStatus, useUpdateProduct,
} from '@workspace/api-client-react';
import type { Order, Product } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
type CartLine = { product: Product; quantity: number };
type ToastMessage = { text: string; tone?: 'good' | 'bad' };
type Status = 'New' | 'Processing' | 'Shipped' | 'Completed' | 'Cancelled';

function useCart() {
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem('marketnest-cart') || '{}'); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('marketnest-cart', JSON.stringify(cart)); }, [cart]);
  const add = (id: number) => setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  const remove = (id: number) => setCart((current) => {
    const next = { ...current };
    if (next[id] > 1) next[id] -= 1; else delete next[id];
    return next;
  });
  const clear = () => setCart({});
  return { cart, add, remove, clear, count: Object.values(cart).reduce((sum, value) => sum + value, 0) };
}

function useToastMessage() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const show = (text: string, tone: ToastMessage['tone'] = 'good') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2800);
  };
  return { toast, show };
}

function Shell({ children, cartCount }: { children: ReactNode; cartCount: number }) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] market-shell">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.96)]">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" data-testid="link-brand" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--accent))]"><Store size={18} /></span>
            <span className="text-[19px] font-bold tracking-[-.03em]">MarketNest<span className="text-[hsl(var(--primary))]">.</span></span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" data-testid="link-shop" className={`text-sm font-semibold ${location === '/' ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>Shop</Link>
            <Link href="/admin" data-testid="link-admin" className={`text-sm font-semibold ${location === '/admin' ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>Store admin</Link>
          </nav>
          <Link href="/cart" data-testid="link-cart" className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-bold hover:border-[hsl(var(--primary)/.55)]">
            <ShoppingBag size={16} /><span className="hidden sm:inline">Basket</span>
            <span data-testid="text-cart-count" className="grid min-w-5 place-items-center rounded-full bg-[hsl(var(--accent))] px-1.5 py-0.5 text-[11px]">{cartCount}</span>
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-20 max-w-6xl border-t border-[hsl(var(--border))] px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-2 text-sm text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[hsl(var(--foreground))]">MarketNest</p>
          <p>A small online shop run by people who like useful things.</p>
        </div>
      </footer>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  if (!toast) return null;
  return <div data-testid="status-toast" className={`fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold shadow-lg ${toast.tone === 'bad' ? 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]' : 'bg-[hsl(var(--foreground))] text-[hsl(var(--card))]'}`}>
    {toast.tone === 'bad' ? <CircleAlert size={16} /> : <Check size={16} />} {toast.text}
    <button onClick={onClose} data-testid="button-close-toast" aria-label="Close message" className="ml-2 opacity-65 hover:opacity-100"><X size={15} /></button>
  </div>;
}

function LoadingCards() {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading products">
    {[1, 2, 3].map((item) => <div key={item} className="animate-pulse rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="h-52 rounded-md bg-[hsl(var(--muted))]" /><div className="mt-4 h-5 w-3/5 rounded bg-[hsl(var(--muted))]" /><div className="mt-3 h-4 w-full rounded bg-[hsl(var(--muted))]" /><div className="mt-5 h-10 rounded-md bg-[hsl(var(--muted))]" />
    </div>)}
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.65)] px-6 py-14 text-center">
    <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Package size={20} /></div>
    <h2 className="font-display text-2xl">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{body}</p>{action && <div className="mt-5">{action}</div>}
  </div>;
}

function ProductArtwork({ product, large = false }: { product: Product; large?: boolean }) {
  return <div className={`relative overflow-hidden rounded-md bg-[hsl(var(--muted))] ${large ? 'h-72 sm:h-[380px]' : 'h-52'}`}>
    {product.imageUrl ? <img data-testid={`img-product-${product.id}`} src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> :
      <div className="soft-grid flex h-full items-center justify-center"><span className="font-display text-6xl text-[hsl(var(--foreground)/.25)]">{product.icon || product.name.slice(0, 1)}</span></div>}
  </div>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  return <article data-testid={`card-product-${product.id}`} className="group lift rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
    <ProductArtwork product={product} />
    <div className="px-1 pb-1 pt-4">
      <div className="flex items-start justify-between gap-3"><h3 data-testid={`text-product-name-${product.id}`} className="font-semibold leading-tight">{product.name}</h3><span data-testid={`text-product-price-${product.id}`} className="shrink-0 text-sm font-bold">${product.price.toFixed(2)}</span></div>
      <p data-testid={`text-product-description-${product.id}`} className="mt-2 line-clamp-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{product.description}</p>
      <button onClick={() => onAdd(product)} data-testid={`button-add-product-${product.id}`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--foreground))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--card))] hover:bg-[hsl(var(--primary))] active:scale-[.99]"><Plus size={16} /> Add to basket</button>
    </div>
  </article>;
}

function HomePage({ cart }: { cart: ReturnType<typeof useCart> }) {
  const [search, setSearch] = useState('');
  const { show, toast } = useToastMessage();
  const productsQuery = useListProducts(search ? { search } : undefined, { query: { staleTime: 30000, queryKey: getListProductsQueryKey(search ? { search } : undefined) } });
  const products = productsQuery.data || [];
  return <Shell cartCount={cart.count}><div className="page-in">
    <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-14 pt-12 sm:px-8 sm:pt-16 md:grid-cols-[1.3fr_.7fr] md:items-end">
      <div><p className="mb-4 text-sm font-bold text-[hsl(var(--primary))]">Welcome to MarketNest</p><h1 className="max-w-xl font-display text-5xl leading-[1.03] tracking-[-.04em] sm:text-6xl">Useful things for your home and day.</h1><p className="mt-5 max-w-lg text-base leading-7 text-[hsl(var(--muted-foreground))]">I keep this shop small and only add products I would use myself. Take a look around, and thanks for supporting an independent store.</p><a href="#collection" data-testid="link-browse-collection" className="mt-7 inline-flex rounded-md bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] hover:brightness-95">See all products</a></div>
      <div className="border-l-2 border-[hsl(var(--accent))] pl-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]"><p className="font-semibold text-[hsl(var(--foreground))]">A note from the owner</p><p className="mt-2">Orders go out from our little stock room twice a week. If you have a question, just use the email on your order confirmation.</p></div>
    </section>
    <section id="collection" className="mx-auto max-w-6xl px-5 sm:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-end"><div><p className="text-sm text-[hsl(var(--muted-foreground))]">The current selection</p><h2 className="mt-1 font-display text-3xl">Shop products</h2></div>
        <label className="relative block w-full sm:w-64"><Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-product-search" placeholder="Search products" className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]" /></label>
      </div>
      {productsQuery.isLoading ? <LoadingCards /> : productsQuery.isError ? <EmptyState title="Products are unavailable" body="We could not load the shop right now. Please try again." action={<button data-testid="button-retry-products" onClick={() => productsQuery.refetch()} className="rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--card))]">Try again</button>} /> : products.length === 0 ? <EmptyState title="No products found" body="Try a different search, or clear it to see the full shop." action={<button data-testid="button-clear-search" onClick={() => setSearch('')} className="rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--card))]">Clear search</button>} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product, index) => <div key={product.id} className={`pop-in delay-${Math.min(index + 1, 5)}`}><ProductCard product={product} onAdd={(item) => { cart.add(item.id); show(`${item.name} added to basket`); }} /></div>)}</div>}
    </section>
    <section className="mx-auto mt-16 grid max-w-6xl gap-4 px-5 sm:px-8 md:grid-cols-3">
      {[['Shipping', 'Free delivery on every order.'], ['Small batches', 'I restock a few times a month.'], ['Questions?', 'Reply to your order email and I will help.']].map(([title, body]) => <div key={title} className="border-t-2 border-[hsl(var(--secondary))] pt-4"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{body}</p></div>)}
    </section>
    <Toast toast={toast} onClose={() => {}} />
  </div></Shell>;
}

function CartPage({ cart }: { cart: ReturnType<typeof useCart> }) {
  const { show, toast } = useToastMessage();
  const productsQuery = useListProducts(undefined, { query: { staleTime: 30000, queryKey: getListProductsQueryKey() } });
  const lines: CartLine[] = useMemo(() => (productsQuery.data || []).filter((p) => cart.cart[p.id]).map((product) => ({ product, quantity: cart.cart[product.id] })), [productsQuery.data, cart.cart]);
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return <Shell cartCount={cart.count}><div className="page-in mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
    <div className="mb-9 border-b border-[hsl(var(--border))] pb-5"><p className="text-sm text-[hsl(var(--muted-foreground))]">Your order</p><h1 className="mt-1 font-display text-4xl">Basket</h1></div>
    {productsQuery.isLoading ? <LoadingCards /> : productsQuery.isError ? <EmptyState title="Basket unavailable" body="We could not load your products. Please try again." action={<button data-testid="button-retry-cart" onClick={() => productsQuery.refetch()} className="rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--card))]">Try again</button>} /> : lines.length === 0 ? <EmptyState title="Your basket is empty" body="Add something from the shop and it will show up here." action={<Link href="/" data-testid="link-empty-cart-shop" className="inline-flex rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--card))]">Go to shop</Link>} /> :
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]"><div className="space-y-3">{lines.map(({ product, quantity }) => <div data-testid={`row-cart-item-${product.id}`} key={product.id} className="flex gap-4 border-b border-[hsl(var(--border))] pb-4 pt-2 sm:gap-5"><div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-[hsl(var(--muted))]">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center font-display text-3xl text-[hsl(var(--foreground)/.22)]">{product.icon || product.name[0]}</div>}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h2 data-testid={`text-cart-item-name-${product.id}`} className="font-semibold">{product.name}</h2><span className="font-bold">${(product.price * quantity).toFixed(2)}</span></div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">${product.price.toFixed(2)} each</p><div className="mt-4 flex items-center gap-3"><div className="flex items-center rounded-md border border-[hsl(var(--border))]"><button onClick={() => { cart.remove(product.id); show('Basket updated'); }} data-testid={`button-decrease-item-${product.id}`} aria-label={`Decrease ${product.name}`} className="p-2 hover:bg-[hsl(var(--muted))]"><Minus size={14} /></button><span data-testid={`text-cart-item-quantity-${product.id}`} className="min-w-7 text-center text-sm font-bold">{quantity}</span><button onClick={() => { cart.add(product.id); show('Basket updated'); }} data-testid={`button-increase-item-${product.id}`} aria-label={`Increase ${product.name}`} className="p-2 hover:bg-[hsl(var(--muted))]"><Plus size={14} /></button></div><button onClick={() => { for (let index = 0; index < quantity; index += 1) cart.remove(product.id); show('Item removed'); }} data-testid={`button-remove-item-${product.id}`} className="text-xs font-semibold text-[hsl(var(--muted-foreground))] underline-offset-4 hover:text-[hsl(var(--destructive))] hover:underline">Remove</button></div></div></div>)}</div>
        <aside className="h-fit rounded-lg bg-[hsl(var(--foreground))] p-6 text-[hsl(var(--card))] lg:sticky lg:top-24"><h2 className="font-semibold">Order summary</h2><div className="mt-5 flex justify-between border-b border-[hsl(var(--card)/.2)] pb-4 text-sm text-[hsl(var(--card)/.7)]"><span>{cart.count} {cart.count === 1 ? 'item' : 'items'}</span><span>${total.toFixed(2)}</span></div><div className="mt-4 flex justify-between text-lg font-bold"><span>Total</span><span data-testid="text-cart-total">${total.toFixed(2)}</span></div><Link href="/checkout" data-testid="link-proceed-checkout" className="mt-7 flex items-center justify-center rounded-md bg-[hsl(var(--accent))] px-4 py-3 text-sm font-bold text-[hsl(var(--foreground))] hover:brightness-95">Continue to checkout</Link><p className="mt-3 text-center text-xs text-[hsl(var(--card)/.58)]">Delivery is included.</p></aside>
      </div>}
    <Toast toast={toast} onClose={() => {}} />
  </div></Shell>;
}

function CheckoutPage({ cart }: { cart: ReturnType<typeof useCart> }) {
  const { show, toast } = useToastMessage();
  const productsQuery = useListProducts(undefined, { query: { staleTime: 30000, queryKey: getListProductsQueryKey() } });
  const createOrder = useCreateOrder();
  const lines = (productsQuery.data || []).filter((product) => cart.cart[product.id]).map((product) => ({ product, quantity: cart.cart[product.id] }));
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', address: '' });
  const [done, setDone] = useState<Order | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.customerName || !form.email || !form.address || lines.length === 0) { show('Please fill in your name, email, and address.', 'bad'); return; } createOrder.mutate({ data: { ...form, items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })) } }, { onSuccess: (order) => { cart.clear(); setDone(order); }, onError: () => show('We could not place the order. Please try again.', 'bad') }); };
  if (done) return <Shell cartCount={0}><div className="page-in mx-auto max-w-2xl px-5 py-20 text-center sm:py-28"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--secondary))]"><Check size={30} /></div><p className="mt-7 text-sm font-semibold text-[hsl(var(--primary))]">Order {done.id ? `#${done.id}` : 'confirmed'}</p><h1 className="mt-2 font-display text-4xl">Thanks for your order.</h1><p className="mx-auto mt-4 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">We have your order, {done.customerName}. We will send updates to {done.email} when it is packed and shipped.</p><Link href="/" data-testid="link-continue-shopping" className="mt-8 inline-flex rounded-md bg-[hsl(var(--foreground))] px-5 py-3 text-sm font-bold text-[hsl(var(--card))]">Continue shopping</Link></div></Shell>;
  return <Shell cartCount={cart.count}><div className="page-in mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"><div className="mb-9 border-b border-[hsl(var(--border))] pb-5"><p className="text-sm text-[hsl(var(--muted-foreground))]">Almost done</p><h1 className="mt-1 font-display text-4xl">Checkout</h1></div>
    {productsQuery.isLoading ? <LoadingCards /> : lines.length === 0 ? <EmptyState title="Your basket is empty" body="Add a product before checking out." action={<Link href="/" data-testid="link-checkout-empty-shop" className="inline-flex rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--card))]">Go to shop</Link>} /> : <div className="grid gap-10 lg:grid-cols-[1fr_340px]"><form onSubmit={submit} className="max-w-xl space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name" required value={form.customerName} onChange={(value) => update('customerName', value)} testId="input-customer-name" placeholder="Your name" /><Field label="Email" required type="email" value={form.email} onChange={(value) => update('email', value)} testId="input-customer-email" placeholder="you@example.com" /></div><Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} testId="input-customer-phone" placeholder="Optional" /><Field label="Delivery address" required value={form.address} onChange={(value) => update('address', value)} testId="input-customer-address" placeholder="Street, city, state" textarea /><button disabled={createOrder.isPending} data-testid="button-place-order" className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-wait disabled:opacity-70">{createOrder.isPending && <Loader2 className="animate-spin" size={17} />}{createOrder.isPending ? 'Placing order' : 'Place order'}</button><p className="text-center text-xs text-[hsl(var(--muted-foreground))]">No account is needed.</p></form>
      <aside className="h-fit rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><h2 className="font-semibold">Your items</h2><div className="mt-5 space-y-3">{lines.map(({ product, quantity }) => <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="text-[hsl(var(--muted-foreground))]">{product.name} <b className="text-[hsl(var(--foreground))]">({quantity})</b></span><span className="font-bold">${(product.price * quantity).toFixed(2)}</span></div>)}</div><div className="mt-5 flex justify-between border-t border-[hsl(var(--border))] pt-4 font-bold"><span>Total</span><span data-testid="text-checkout-total">${total.toFixed(2)}</span></div><div className="mt-4 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Truck size={15} /> Delivery included</div></aside></div>}
    <Toast toast={toast} onClose={() => {}} />
  </div></Shell>;
}

function Field({ label, value, onChange, testId, placeholder, type = 'text', required, textarea }: { label: string; value: string; onChange: (value: string) => void; testId: string; placeholder: string; type?: string; required?: boolean; textarea?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}{required && <span className="ml-1 text-[hsl(var(--primary))]">*</span>}</span>{textarea ? <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} placeholder={placeholder} rows={3} className="w-full resize-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]" /> : <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} placeholder={placeholder} className="h-11 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]" />}</label>;
}

function AdminPage() {
  const client = useQueryClient();
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders({ limit: 20 });
  const summaryQuery = useGetAdminSummary();
  const updateStatus = useUpdateOrderStatus();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { show, toast } = useToastMessage();
  const [tab, setTab] = useState<'catalog' | 'orders'>('catalog');
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; id?: number } | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', icon: '', imageUrl: '' });
  const editQuery = useGetProduct(editor?.id || 0, { query: { enabled: !!editor?.id, queryKey: getGetProductQueryKey(editor?.id || 0) } });
  useEffect(() => { if (editor?.mode === 'edit' && editQuery.data) setForm({ name: editQuery.data.name, description: editQuery.data.description, price: String(editQuery.data.price), icon: editQuery.data.icon, imageUrl: editQuery.data.imageUrl }); }, [editor?.mode, editor?.id, editQuery.data]);
  const refresh = () => { client.invalidateQueries({ queryKey: getListProductsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); };
  const openCreate = () => { setForm({ name: '', description: '', price: '', icon: '', imageUrl: '' }); setEditor({ mode: 'create' }); };
  const submitProduct = (event: FormEvent) => { event.preventDefault(); const data = { name: form.name, description: form.description, price: Number(form.price), icon: form.icon, imageUrl: form.imageUrl }; if (!data.name || Number.isNaN(data.price) || data.price < 0) { show('Enter a product name and a valid price.', 'bad'); return; } if (editor?.mode === 'edit' && editor.id) updateProduct.mutate({ productId: editor.id, data }, { onSuccess: () => { show('Product updated'); setEditor(null); refresh(); }, onError: () => show('Could not update product.', 'bad') }); else createProduct.mutate({ data }, { onSuccess: () => { show('Product added'); setEditor(null); refresh(); }, onError: () => show('Could not add product.', 'bad') }); };
  const remove = (product: Product) => { if (!window.confirm(`Remove ${product.name} from the catalog?`)) return; deleteProduct.mutate({ productId: product.id }, { onSuccess: () => { show('Product removed'); refresh(); }, onError: () => show('Could not remove product.', 'bad') }); };
  const orders = ordersQuery.data || [];
  return <Shell cartCount={0}><div className="page-in mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <div className="flex flex-col justify-between gap-5 border-b border-[hsl(var(--border))] pb-7 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"><LayoutDashboard size={16} /> Store admin</div><h1 className="font-display text-4xl">Your shop</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Manage products and keep track of orders.</p></div><button onClick={openCreate} data-testid="button-new-product" className="flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--foreground))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--card))] hover:bg-[hsl(var(--primary))]"><Plus size={16} /> Add product</button></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-3">{[{ label: 'Products', value: summaryQuery.data?.productCount ?? '—', icon: Store }, { label: 'Orders', value: summaryQuery.data?.orderCount ?? '—', icon: Package }, { label: 'Revenue', value: summaryQuery.data ? `$${summaryQuery.data.revenue.toFixed(2)}` : '—', icon: BarChart3 }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><Icon className="mb-5 text-[hsl(var(--primary))]" size={17} /><p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{label}</p><p data-testid={`text-summary-${label}`} className="mt-1 font-display text-2xl">{value}</p></div>)}</div>
    <div className="mt-10 flex items-center gap-5 border-b border-[hsl(var(--border))]"><button onClick={() => setTab('catalog')} data-testid="button-tab-catalog" className={`border-b-2 pb-3 text-sm font-bold ${tab === 'catalog' ? 'border-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Catalog <span className="ml-1 text-xs">({productsQuery.data?.length ?? 0})</span></button><button onClick={() => setTab('orders')} data-testid="button-tab-orders" className={`border-b-2 pb-3 text-sm font-bold ${tab === 'orders' ? 'border-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Orders <span className="ml-1 text-xs">({orders.length})</span></button></div>
    {tab === 'catalog' ? <CatalogTable products={productsQuery.data || []} loading={productsQuery.isLoading} error={productsQuery.isError} onRetry={() => productsQuery.refetch()} onEdit={(product) => setEditor({ mode: 'edit', id: product.id })} onDelete={remove} /> : <OrdersTable orders={orders} loading={ordersQuery.isLoading} error={ordersQuery.isError} onRetry={() => ordersQuery.refetch()} onStatus={(order, status) => updateStatus.mutate({ orderId: order.id, data: { status } }, { onSuccess: () => { show(`Order #${order.id} updated`); client.invalidateQueries({ queryKey: getListOrdersQueryKey({ limit: 20 }) }); client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); }, onError: () => show('Could not update order status.', 'bad') })} />}
    {editor && <ProductEditor editor={editor} form={form} setForm={setForm} onClose={() => setEditor(null)} onSubmit={submitProduct} pending={createProduct.isPending || updateProduct.isPending} />}
    <Toast toast={toast} onClose={() => {}} />
  </div></Shell>;
}

function CatalogTable({ products, loading, error, onRetry, onEdit, onDelete }: { products: Product[]; loading: boolean; error: boolean; onRetry: () => void; onEdit: (p: Product) => void; onDelete: (p: Product) => void }) {
  if (loading) return <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]"><Loader2 className="mx-auto mb-3 animate-spin" size={20} />Loading products</div>;
  if (error) return <EmptyState title="Catalog unavailable" body="We could not load your products." action={<button data-testid="button-retry-admin-products" onClick={onRetry} className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-bold text-[hsl(var(--card))]">Try again</button>} />;
  if (!products.length) return <div className="mt-7"><EmptyState title="No products yet" body="Add your first product to start selling." /></div>;
  return <div className="mt-6 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="hidden grid-cols-[1fr_130px_120px_100px] gap-4 border-b border-[hsl(var(--border))] px-5 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] sm:grid"><span>Product</span><span>Price</span><span>Added</span><span /></div>{products.map((product) => <div data-testid={`row-admin-product-${product.id}`} key={product.id} className="grid gap-3 border-b border-[hsl(var(--border)/.75)] px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_130px_120px_100px] sm:items-center sm:gap-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-[hsl(var(--muted))]">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-lg text-[hsl(var(--foreground)/.3)]">{product.icon || product.name[0]}</span>}</div><div><p className="font-semibold">{product.name}</p><p className="line-clamp-1 text-xs text-[hsl(var(--muted-foreground))]">{product.description}</p></div></div><span className="text-sm font-bold">${product.price.toFixed(2)}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'Recently'}</span><div className="flex gap-1"><button onClick={() => onEdit(product)} data-testid={`button-edit-product-${product.id}`} aria-label={`Edit ${product.name}`} className="rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Pencil size={15} /></button><button onClick={() => onDelete(product)} data-testid={`button-delete-product-${product.id}`} aria-label={`Delete ${product.name}`} className="rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]"><Trash2 size={15} /></button></div></div>)}</div>;
}

function OrdersTable({ orders, loading, error, onRetry, onStatus }: { orders: Order[]; loading: boolean; error: boolean; onRetry: () => void; onStatus: (o: Order, s: Status) => void }) {
  if (loading) return <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]"><Loader2 className="mx-auto mb-3 animate-spin" size={20} />Loading orders</div>;
  if (error) return <EmptyState title="Orders unavailable" body="We could not load recent orders." action={<button data-testid="button-retry-admin-orders" onClick={onRetry} className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-bold text-[hsl(var(--card))]">Try again</button>} />;
  if (!orders.length) return <div className="mt-7"><EmptyState title="No orders yet" body="New orders will appear here." /></div>;
  return <div className="mt-6 space-y-3">{orders.map((order) => <div data-testid={`row-admin-order-${order.id}`} key={order.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-[hsl(var(--secondary))]"><UserRound size={17} /></div><div><p className="font-semibold">{order.customerName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Order #{order.id} · {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} items</p></div></div><div className="flex flex-wrap items-center gap-3"><span data-testid={`status-order-${order.id}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${order.status === 'Completed' ? 'bg-[hsl(var(--secondary))]' : order.status === 'Cancelled' ? 'bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent)/.6)]'}`}>{order.status}</span><span className="font-bold">${order.total.toFixed(2)}</span><select value={order.status} onChange={(event) => onStatus(order, event.target.value as Status)} data-testid={`select-order-status-${order.id}`} aria-label={`Status for order ${order.id}`} className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-xs font-semibold outline-none"><option>New</option><option>Processing</option><option>Shipped</option><option>Completed</option><option>Cancelled</option></select></div></div></div>)}</div>;
}

function ProductEditor({ editor, form, setForm, onClose, onSubmit, pending }: { editor: { mode: 'create' | 'edit'; id?: number }; form: { name: string; description: string; price: string; icon: string; imageUrl: string }; setForm: (form: { name: string; description: string; price: string; icon: string; imageUrl: string }) => void; onClose: () => void; onSubmit: (event: FormEvent) => void; pending: boolean }) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.35)] p-0 sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-[hsl(var(--card))] p-6 shadow-xl sm:rounded-xl sm:p-7"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] pb-5"><div><p className="text-sm font-semibold text-[hsl(var(--primary))]">{editor.mode === 'create' ? 'Add product' : 'Edit product'}</p><h2 className="mt-1 font-display text-2xl">{editor.mode === 'create' ? 'Add something to the shop' : 'Update product details'}</h2></div><button onClick={onClose} data-testid="button-close-product-editor" aria-label="Close product editor" className="rounded-md p-2 hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><Field label="Name" required value={form.name} onChange={(value) => update('name', value)} testId="input-admin-product-name" placeholder="Product name" /><Field label="Description" value={form.description} onChange={(value) => update('description', value)} testId="input-admin-product-description" placeholder="A short description" textarea /><div className="grid gap-4 sm:grid-cols-2"><Field label="Price" required type="number" value={form.price} onChange={(value) => update('price', value)} testId="input-admin-product-price" placeholder="24.00" /><Field label="Short mark" value={form.icon} onChange={(value) => update('icon', value)} testId="input-admin-product-icon" placeholder="Optional" /></div><Field label="Image URL" value={form.imageUrl} onChange={(value) => update('imageUrl', value)} testId="input-admin-product-image" placeholder="Optional image URL" /><button disabled={pending} data-testid="button-save-product" className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-70">{pending && <Loader2 className="animate-spin" size={17} />}{editor.mode === 'create' ? 'Add product' : 'Save changes'}</button></form></div></div>;
}

function Router() {
  const cart = useCart();
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={() => <HomePage cart={cart} />} /><Route path="/cart" component={() => <CartPage cart={cart} />} /><Route path="/checkout" component={() => <CheckoutPage cart={cart} />} /><Route path="/admin" component={AdminPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;