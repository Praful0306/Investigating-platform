import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal.jsx';

const Harness = ({ onClose = () => {}, dismissible, withInput = false, initiallyOpen = true }) => {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Modal
        open={open}
        onClose={() => { onClose(); setOpen(false); }}
        title="Accuse Arjun Rao?"
        description="You can accuse only once."
        dismissible={dismissible}
        footer={<><button>Cancel</button><button>Confirm</button></>}
      >
        {withInput && <input aria-label="Reason" />}
        <p>This is final.</p>
      </Modal>
    </div>
  );
};

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Harness initiallyOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is an accessible dialog: role, aria-modal, labelled by its title, described by its text', () => {
    render(<Harness />);
    const d = screen.getByRole('dialog', { name: 'Accuse Arjun Rao?' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d).toHaveAccessibleDescription('You can accuse only once.');
    expect(screen.getByText('This is final.')).toBeInTheDocument();
  });

  it('renders in a portal on <body>, not inside the page tree', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('moves focus into the dialog when it opens', () => {
    render(<Harness />);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
  });

  it('keeps Tab and Shift+Tab inside the dialog (focus trap)', async () => {
    const user = userEvent.setup();
    render(<Harness withInput />);
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it('Escape closes it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking the backdrop closes it when dismissible', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the dialog does not close it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByText('This is final.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('with dismissible={false} the backdrop does nothing but Escape still works', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} dismissible={false} />);
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness initiallyOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('locks page scroll while open and restores it after', async () => {
    document.body.style.overflow = 'auto';
    render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('removes its key listener on close (no stray Escape handling)', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
