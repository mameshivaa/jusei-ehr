"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "fade" | "slide" | "scale" | "slideUp";
  duration?: number;
  useAnimatePresence?: boolean;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
};

export default function PageTransition({
  children,
  className = "",
  variant = "fade",
  duration = 0.3,
  useAnimatePresence = false,
}: PageTransitionProps) {
  const motionVariants = variants[variant];
  const transition = { duration, ease: [0.25, 0.46, 0.45, 0.94] as const };
  const content = (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={motionVariants}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
  if (useAnimatePresence) {
    return <AnimatePresence mode="wait">{content}</AnimatePresence>;
  }
  return content;
}

export function ModalTransition({
  children,
  isOpen,
  className = "",
}: {
  children: React.ReactNode;
  isOpen: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
