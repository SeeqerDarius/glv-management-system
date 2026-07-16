"use client";

import { useEffect, useState } from "react";
import { CalculatorIcon, DeleteIcon, XIcon } from "lucide-react";
import { DraggableFloating } from "@/components/draggable-floating";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "x" | "/";

type CalculatorState = {
  display: string;
  previousValue: number | null;
  operator: Operator | null;
  waitingForOperand: boolean;
  expression: string;
};

const initialState: CalculatorState = {
  display: "0",
  previousValue: null,
  operator: null,
  waitingForOperand: false,
  expression: "",
};

const operatorLabels: Record<Operator, string> = {
  "+": "+",
  "-": "-",
  x: "x",
  "/": "÷",
};

function toNumber(value: string) {
  return Number(value.replace(/,/g, ""));
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  const rounded = Number.parseFloat(value.toFixed(10));
  const text = String(rounded);
  return text.length > 16 ? rounded.toExponential(8) : text;
}

function calculate(left: number, operator: Operator, right: number) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "x":
      return left * right;
    case "/":
      return right === 0 ? Number.NaN : left / right;
  }
}

function CalculatorButton({
  children,
  className,
  onClick,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-semibold text-gray-800 transition hover:border-green-700 hover:bg-green-50 active:translate-y-px",
        className
      )}
    >
      {children}
    </button>
  );
}

export function CalculatorWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CalculatorState>(initialState);

  function clear() {
    setState(initialState);
  }

  function inputDigit(digit: string) {
    setState((current) => {
      if (current.display === "Error") {
        return { ...initialState, display: digit };
      }

      if (current.waitingForOperand) {
        return { ...current, display: digit, waitingForOperand: false };
      }

      if (current.display.replace("-", "").replace(".", "").length >= 14) {
        return current;
      }

      return {
        ...current,
        display: current.display === "0" ? digit : `${current.display}${digit}`,
      };
    });
  }

  function inputDecimal() {
    setState((current) => {
      if (current.display === "Error") {
        return { ...initialState, display: "0." };
      }

      if (current.waitingForOperand) {
        return { ...current, display: "0.", waitingForOperand: false };
      }

      return current.display.includes(".")
        ? current
        : { ...current, display: `${current.display}.` };
    });
  }

  function backspace() {
    setState((current) => {
      if (current.display === "Error" || current.waitingForOperand) {
        return { ...current, display: "0", waitingForOperand: false };
      }

      const next = current.display.length > 1 ? current.display.slice(0, -1) : "0";
      return { ...current, display: next === "-" ? "0" : next };
    });
  }

  function toggleSign() {
    setState((current) => {
      if (current.display === "0" || current.display === "Error") {
        return current;
      }

      return {
        ...current,
        display: current.display.startsWith("-")
          ? current.display.slice(1)
          : `-${current.display}`,
      };
    });
  }

  function percent() {
    setState((current) => {
      const value = toNumber(current.display);
      return { ...current, display: formatNumber(value / 100) };
    });
  }

  function chooseOperator(nextOperator: Operator) {
    setState((current) => {
      const inputValue = toNumber(current.display);

      if (current.display === "Error") {
        return initialState;
      }

      if (current.previousValue === null) {
        return {
          ...current,
          previousValue: inputValue,
          operator: nextOperator,
          waitingForOperand: true,
          expression: `${formatNumber(inputValue)} ${operatorLabels[nextOperator]}`,
        };
      }

      if (current.operator && !current.waitingForOperand) {
        const result = calculate(current.previousValue, current.operator, inputValue);
        const display = formatNumber(result);
        return {
          ...current,
          display,
          previousValue: result,
          operator: nextOperator,
          waitingForOperand: true,
          expression: `${display} ${operatorLabels[nextOperator]}`,
        };
      }

      return {
        ...current,
        operator: nextOperator,
        expression: `${formatNumber(current.previousValue)} ${operatorLabels[nextOperator]}`,
      };
    });
  }

  function equals() {
    setState((current) => {
      if (
        current.display === "Error" ||
        current.previousValue === null ||
        current.operator === null
      ) {
        return current;
      }

      const inputValue = toNumber(current.display);
      const result = calculate(current.previousValue, current.operator, inputValue);
      const display = formatNumber(result);

      return {
        display,
        previousValue: null,
        operator: null,
        waitingForOperand: true,
        expression: `${formatNumber(current.previousValue)} ${operatorLabels[current.operator]} ${formatNumber(inputValue)} =`,
      };
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        inputDigit(event.key);
      } else if (event.key === ".") {
        event.preventDefault();
        inputDecimal();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        equals();
      } else if (event.key === "+" || event.key === "-" || event.key === "/" || event.key === "*") {
        event.preventDefault();
        chooseOperator(event.key === "*" ? "x" : event.key);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <DraggableFloating
      storageKey="glv-calculator-position"
      defaultPlacement="bottom-left"
      className="fixed z-50 touch-none"
    >
      {({ dragHandleProps, isDragging }) => (
      <>
      {open ? (
        <section className="mb-3 w-[calc(100vw-2rem)] max-w-xs overflow-hidden rounded-lg border bg-white shadow-2xl ring-1 ring-gray-950/5">
          <div className="flex items-center justify-between gap-3 border-b bg-green-950 px-4 py-3 text-white">
            <div
              {...dragHandleProps}
              className="flex min-w-0 cursor-move touch-none select-none items-center gap-3"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-lime-400 text-green-950">
                <CalculatorIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">Calculator</h2>
                <p className="truncate text-xs text-lime-100">Quick business calculations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white"
              aria-label="Close calculator"
              title="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="bg-gray-950 px-4 py-4 text-right text-white">
            <p className="h-5 truncate text-xs text-gray-400">{state.expression}</p>
            <p className="mt-1 truncate text-3xl font-semibold tabular-nums">{state.display}</p>
          </div>

          <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3">
            <CalculatorButton className="bg-gray-100" onClick={clear}>C</CalculatorButton>
            <CalculatorButton className="bg-gray-100" onClick={toggleSign}>+/-</CalculatorButton>
            <CalculatorButton className="bg-gray-100" onClick={percent}>%</CalculatorButton>
            <CalculatorButton className="bg-lime-100 text-green-950" onClick={() => chooseOperator("/")}>÷</CalculatorButton>

            {["7", "8", "9"].map((digit) => (
              <CalculatorButton key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorButton>
            ))}
            <CalculatorButton className="bg-lime-100 text-green-950" onClick={() => chooseOperator("x")}>x</CalculatorButton>

            {["4", "5", "6"].map((digit) => (
              <CalculatorButton key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorButton>
            ))}
            <CalculatorButton className="bg-lime-100 text-green-950" onClick={() => chooseOperator("-")}>-</CalculatorButton>

            {["1", "2", "3"].map((digit) => (
              <CalculatorButton key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorButton>
            ))}
            <CalculatorButton className="bg-lime-100 text-green-950" onClick={() => chooseOperator("+")}>+</CalculatorButton>

            <CalculatorButton onClick={backspace} title="Backspace">
              <DeleteIcon className="size-4" />
            </CalculatorButton>
            <CalculatorButton onClick={() => inputDigit("0")}>0</CalculatorButton>
            <CalculatorButton onClick={inputDecimal}>.</CalculatorButton>
            <CalculatorButton className="bg-green-950 text-white hover:bg-green-900" onClick={equals}>=</CalculatorButton>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        {...dragHandleProps}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group/calculator flex size-14 touch-none items-center justify-center rounded-full bg-lime-400 text-green-950 shadow-xl ring-1 ring-green-900/20 transition hover:-translate-y-0.5 hover:bg-lime-300 focus:outline-none focus:ring-4 focus:ring-lime-300/40",
          isDragging && "cursor-grabbing"
        )}
        aria-label="Open calculator"
        title="Calculator"
      >
        <CalculatorIcon className="size-6 transition-transform group-hover/calculator:scale-110" />
      </button>
      </>
      )}
    </DraggableFloating>
  );
}
