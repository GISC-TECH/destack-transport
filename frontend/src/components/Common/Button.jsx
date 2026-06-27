import { forwardRef } from 'react';
import styles from './Button.module.css';

/**
 * Button — componente base de botão.
 *
 * Props:
 * - variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost' | 'gold'
 * - size: 'sm' | 'md' | 'lg'
 * - iconOnly: boolean — quando true, o botão vira quadrado e oculta o texto (use aria-label)
 * - loading: boolean — desabilita e mostra spinner
 * - children: conteúdo
 * - ...rest: props nativas de button
 */
const Button = forwardRef(function Button(
  {
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
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.content}>{children}</span>
    </button>
  );
});

export default Button;
