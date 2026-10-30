import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthShell } from './AuthShell.jsx';
import { GoogleButton } from './GoogleButton.jsx';
import { PasswordField } from './PasswordField.jsx';
import { TextField } from './TextField.jsx';

describe('TextField', () => {
  it('has a visible label tied to the input', () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInstanceOf(HTMLInputElement);
  });

  it('passes the usual input attributes through', () => {
    render(<TextField label="Email" type="email" autoComplete="username" inputMode="email" maxLength={254} />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input).toHaveAttribute('maxlength', '254');
  });

  it('shows the error right under the field and marks the field invalid, tied together for screen readers', () => {
    render(<TextField label="Email" error="Enter your email address." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = screen.getByText('Enter your email address.');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('is not marked invalid when there is no error', () => {
    render(<TextField label="Email" hint="We never share it." />);
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByText('We never share it.').id);
  });

  it('is controlled by the form around it', async () => {
    const onChange = vi.fn();
    render(<TextField label="Email" value="a" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Email'), 'b');
    expect(onChange).toHaveBeenCalled();
  });

  it('two fields never share ids', () => {
    render(<><TextField label="One" error="e1" /><TextField label="Two" error="e2" /></>);
    expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
    expect(screen.getByText('e1').id).not.toBe(screen.getByText('e2').id);
  });
});

describe('PasswordField', () => {
  it('hides the password, and a button shows or hides it again', async () => {
    render(<PasswordField label="Password" defaultValue="hunter2hunter2" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: /show password/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('the toggle is not a submit button (it must not send the form)', () => {
    render(<form onSubmit={(e) => e.preventDefault()}><PasswordField label="Password" /></form>);
    expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute('type', 'button');
  });

  it('keeps what was typed when toggling', async () => {
    render(<PasswordField label="Password" />);
    await userEvent.type(screen.getByLabelText('Password'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText('Password')).toHaveValue('abc');
  });

  it('shows no strength meter by default (sign-in)', () => {
    render(<PasswordField label="Password" value="abcdefghijkl" onChange={() => {}} />);
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('with showStrength: a meter and a word that follow the password', () => {
    const { rerender } = render(<PasswordField label="Password" showStrength value="abc" onChange={() => {}} />);
    expect(screen.getByRole('meter', { name: /password strength/i })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    rerender(<PasswordField label="Password" showStrength value="correct horse battery" onChange={() => {}} />);
    expect(screen.getByRole('meter', { name: /password strength/i })).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows no meter while the box is empty (nothing to judge yet)', () => {
    render(<PasswordField label="Password" showStrength value="" onChange={() => {}} />);
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('still shows an error under the field', () => {
    render(<PasswordField label="Password" error="Use at least 8 characters." />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
  });
});

describe('GoogleButton', () => {
  it('says what it does and calls back on click', async () => {
    const onClick = vi.fn();
    render(<GoogleButton onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is busy while waiting and cannot be clicked twice', async () => {
    const onClick = vi.fn();
    render(<GoogleButton loading onClick={onClick} />);
    const button = screen.getByRole('button', { name: /continue with google/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('the logo is decoration (the name comes from the text)', () => {
    render(<GoogleButton onClick={() => {}} />);
    expect(screen.getByRole('button').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is a plain button, so it never submits a form by accident', () => {
    render(<GoogleButton onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('AuthShell', () => {
  const shell = (props) => render(<MemoryRouter><AuthShell title="Sign in" subtitle="Welcome back." {...props}><p>FORM</p></AuthShell></MemoryRouter>);

  it('has exactly one h1, the title, with the subtitle and the form', () => {
    shell();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back.')).toBeInTheDocument();
    expect(screen.getByText('FORM')).toBeInTheDocument();
  });

  it('tells guests they can still play without an account', () => {
    shell();
    expect(screen.getByText(/play as a guest/i)).toBeInTheDocument();
  });

  it('shows what an account gives (saved cases, any device)', () => {
    shell();
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });
});
