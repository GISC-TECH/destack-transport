import { forwardRef } from 'react';
import styles from './Button.module.css';

/**
 * Button — componente base de botão.
 *
 * Props:
 * - as: componente alternativo (ex: Link do react-router-dom)
 * - variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost' | 'gold'
 * - size: 'sm' | 'md' | 'lg'
 * - iconOnly: boolean — quando true, o botão vira quadrado e oculta o texto (use aria-label)
 * - loading: boolean — desabilita e mostra spinner
 * - children: conteúdo
 * - ...rest: props nativas do elemento
 */
const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    loading = false,
    disabled = false,
    children,
    className = '',
    ...rest
  },
  ref
) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly && styles.iconOnly,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      ref={ref}
      className={classes}
      disabled={Component === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.content}>{children}</span>
    </Component>
  );
});

export default Button;
