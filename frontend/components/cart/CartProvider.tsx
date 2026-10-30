'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { addCartItem, clearCart, getCart, removeCartItem, updateCartItem } from '@/lib/api/cart';
import type { CartView } from '@/lib/api/types';

type CartStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CartContextValue {
  cart: CartView | null;
  status: CartStatus;
  /** Units in purchasable lines; 0 when signed out or empty. */
  itemCount: number;
  add: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const userId = user?.id ?? null;
  const [cart, setCart] = useState<CartView | null>(null);
  const [status, setStatus] = useState<CartStatus>('idle');

  // Identifies the signed-in user a response belongs to, so late responses can be ignored.
  const activeUser = useRef<string | null>(null);
  activeUser.current = authStatus === 'authenticated' ? userId : null;

  const reload = useCallback(async () => {
    const forUser = activeUser.current;
    if (!forUser) return;
    setStatus('loading');
    try {
      const next = await getCart();
      if (activeUser.current !== forUser) return;
      setCart(next);
      setStatus('ready');
    } catch {
      if (activeUser.current !== forUser) return;
      setStatus('error');
    }
  }, []);

  // Load when a user is signed in; reset when signed out or when the account changes.
  useEffect(() => {
    if (authStatus === 'authenticated' && userId) {
      void reload();
    } else if (authStatus === 'unauthenticated') {
      setCart(null);
      setStatus('idle');
    }
  }, [authStatus, userId, reload]);

  /** Runs a mutation and replaces the cart with the server's answer. Errors propagate to the caller. */
  const mutate = useCallback(async (action: () => Promise<CartView>) => {
    const forUser = activeUser.current;
    const next = await action();
    if (activeUser.current !== forUser) return;
    setCart(next);
    setStatus('ready');
  }, []);

  const add = useCallback(
    (productId: string, quantity: number, variantId?: string) =>
      mutate(() => addCartItem(productId, quantity, variantId)),
    [mutate],
  );
  const update = useCallback(
    (itemId: string, quantity: number) => mutate(() => updateCartItem(itemId, quantity)),
    [mutate],
  );
  const remove = useCallback((itemId: string) => mutate(() => removeCartItem(itemId)), [mutate]);
  const clear = useCallback(() => mutate(() => clearCart()), [mutate]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      status,
      itemCount: cart?.itemCount ?? 0,
      add,
      update,
      remove,
      clear,
      reload,
    }),
    [cart, status, add, update, remove, clear, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
