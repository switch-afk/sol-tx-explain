'use strict';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// Whole-transaction errors.
const TRANSACTION_ERRORS = {
  AccountNotFound: 'An account the transaction needed does not exist (often a fee payer with no SOL).',
  AccountInUse: 'An account was locked by another transaction at the same time. Retrying usually works.',
  InsufficientFundsForFee: 'The fee payer could not afford the fee.',
  InsufficientFundsForRent: 'An account would have been left below the rent-exempt minimum.',
  ProgramAccountNotFound: 'A program the transaction called does not exist on this network.',
  AlreadyProcessed: 'This exact transaction was already processed.',
  MaxLoadedAccountsDataSizeExceeded: 'The transaction loaded more account data than allowed.',
};

// Errors from inside one instruction.
const INSTRUCTION_ERRORS = {
  InsufficientFunds: 'an account did not have enough funds',
  ComputationalBudgetExceeded:
    'it ran out of compute units, so the compute unit limit was too low for this work',
  MissingRequiredSignature: 'a required signature was missing',
  InvalidAccountData: 'an account held data the program could not use',
  InvalidInstructionData: 'the instruction data was not valid for this program',
  InvalidArgument: 'the program rejected an argument',
  AccountNotRentExempt: 'an account would have been left below the rent-exempt minimum',
  IncorrectProgramId: 'an account was owned by a different program than expected',
  AccountAlreadyInitialized: 'an account was already initialized',
  UninitializedAccount: 'an account was not initialized yet',
  ArithmeticOverflow: 'a calculation overflowed',
  ProgramFailedToComplete: 'the program stopped before finishing (often a crash or running out of compute)',
  IncorrectAuthority: 'the signer was not the right authority for this account',
};

// Custom error codes of the Token program (the first few, the common ones).
const TOKEN_ERRORS = {
  0: 'the token account is below the rent-exempt minimum',
  1: 'the token account does not have enough tokens',
  2: 'the mint is not valid',
  3: 'the token accounts have different mints',
  4: 'the signer does not own this token account',
};

/**
 * A plain-English explanation of a failed transaction's error, or null when we
 * do not recognise it. `instructions` is the summary's instruction list, used to
 * name the program that failed.
 */
function describeErrorHint(err, instructions = []) {
  if (err === null || err === undefined) return null;
  if (typeof err === 'string') return TRANSACTION_ERRORS[err] || null;

  if (err.InstructionError) {
    const [index, detail] = err.InstructionError;
    const ix = instructions[index];
    const where = ix
      ? `Instruction #${index + 1} (${ix.program})`
      : `Instruction #${index + 1}`;

    if (typeof detail === 'string') {
      const text = INSTRUCTION_ERRORS[detail];
      return text ? `${where} failed: ${text}.` : `${where} failed with ${detail}.`;
    }

    if (detail && detail.Custom !== undefined) {
      if (ix && ix.programId === TOKEN_PROGRAM_ID && TOKEN_ERRORS[detail.Custom]) {
        return `${where} failed: ${TOKEN_ERRORS[detail.Custom]}.`;
      }
      return `${where} returned custom error code ${detail.Custom}. Custom codes are defined by that program, so check its docs or source.`;
    }

    return null;
  }

  const key = Object.keys(err).find((name) => TRANSACTION_ERRORS[name]);
  return key ? TRANSACTION_ERRORS[key] : null;
}

module.exports = { describeErrorHint };