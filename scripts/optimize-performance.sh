#!/usr/bin/env bash

# GuildPilot Server Performance Optimizer

echo "Optimizing Linux Server Performance for 24/7 Low-Latency operation..."

# Disable WiFi Power Saving (prevents WiFi card sleep latency)
if command -v iw >/dev/null 2>&1; then
  for dev in $(iw dev | grep Interface | awk '{print $2}'); do
    echo "Disabling WiFi power save on $dev..."
    sudo iw dev "$dev" set power_save off 2>/dev/null || true
  done
fi

# Set CPU Governor to performance (prevents CPU clock throttling)
if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
  echo "Setting CPU governor to performance..."
  for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "performance" | sudo tee "$g" >/dev/null 2>&1 || true
  done
fi

echo "Performance optimizations applied successfully!"
