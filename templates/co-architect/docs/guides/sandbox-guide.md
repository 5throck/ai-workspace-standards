# Operational Guide: Network-Isolated VM Sandbox for ZWCAD Plugin Validation

This document establishes the specifications, setup procedures, and verification protocols for validating untrusted or custom-developed ZWCAD plugins (LISP, ZRX, .NET assemblies, or Python scripts) within a secure Virtual Machine (VM) sandbox.

---

## 1. Sandbox Objectives

The primary goal of the sandbox is to perform **dynamic analysis** of drawing automation plugins prior to corporate deployment. This acts as a secondary line of defense alongside static security analysis (`audit-security.ts`), catching:
1. Unauthorized network socket creations.
2. Silent file system deletions, modifications, or creation of persistence mechanisms (e.g., startup folder drops).
3. Unauthorized registry modifications (especially under HKLM/HKCU startup paths or ZWCAD system registers).

---

## 2. Sandbox VM Specifications

| Component | Specification | Security Justification |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11 Professional (64-bit) | Matches the client-end user workspace environment. |
| **CPU / RAM** | 4 Cores / 8 GB | Standard baseline for ZWCAD 2026 execution. |
| **ZWCAD Version** | ZWCAD 2026 KO | Match exact localized build used by drafting staff. |
| **Network Mode** | **No Connection** (Disabled/Disconnected) | Prevents command-and-control (C2) callback or exfiltration. |
| **Shared Folders** | Disabled | Prevents VM escape threats from crossing to the host machine. |

---

## 3. Dynamic Analysis Tool Suite

The sandbox VM must have the following pre-installed, standalone analysis utilities:

1. **Sysinternals Process Monitor (ProcMon)**: Capture real-time file system, registry, and process/thread activity.
2. **Sysinternals Process Explorer (ProcExp)**: Monitor active process handles, loaded DLLs/ZRXs, and thread stacks.
3. **Regshot**: Take snapshots of the registry before and after plugin execution to detect differences.
4. **Wireshark (Optional)**: Capture loopback/local interface traffic to detect local port-scanning behaviors.

---

## 4. Verification Protocol (Step-by-Step)

Follow this sequence for every validation iteration:

### Step 4.1: VM Initialization
1. Start the hypervisor (Hyper-V, VirtualBox, or VMware).
2. Restore the VM to its **Clean Baseline Snapshot** (a state where only Windows, ZWCAD, and analysis tools are installed).
3. Confirm that the network adapter is disconnected.

### Step 4.2: Registry Baseline (Regshot)
1. Launch **Regshot**.
2. Click **1st shot** to capture the baseline registry hive state.

### Step 4.3: ProcMon Capture Setup
1. Launch **ProcMon**.
2. Clear the default display, then open the filter configuration (`Ctrl + F`).
3. Add the following filters:
   - `Process Name` is `zwcad.exe` -> `Include`
   - `Operation` starts with `Reg` -> `Include` (for registry checks)
   - `Operation` starts with `File` -> `Include` (for file system checks)
   - `Path` contains `co-architect` -> `Exclude` (to reduce noise from workspace files)
4. Start capturing events (`Ctrl + E`).

### Step 4.4: Plugin Execution
1. Copy the target plugin (e.g., LISP code, menu configuration) into the VM via temporary media (ISO mounting or virtual CD creation, avoiding shared folders).
2. Launch **ZWCAD 2026**.
3. Load the plugin:
   - For LISP: Use `APPLOAD` or type `(load "plugin.lsp")`.
   - For CUIX/MNU: Use `CUILOAD` or `MENULOAD`.
4. Run all registered command entry points (e.g., `CA_WALL3D`, `CA_EXCELSYNC`). Use mock drawing templates for geometric verification.
5. Exit ZWCAD.

### Step 4.5: Analysis and Comparison
1. Stop ProcMon capture (`Ctrl + E`).
2. Scan the captured logs for anomalous operations:
   - **File System:** Look for `CreateFile` or `WriteFile` operations targeting paths outside the ZWCAD install directory, Roaming Support, or local project folder. (e.g., checking for drops under `C:\Windows\`, `C:\Users\<user>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`).
   - **Registry:** Check for `RegSetValue` operations targeting Run keys (e.g., `Software\Microsoft\Windows\CurrentVersion\Run`).
3. Switch back to **Regshot**.
4. Click **2nd shot**, then click **Compare**. Analyze the output text file for registry changes.

---

## 5. Pass/Fail Decision Matrix

| Detected Behavior | Risk level | Action |
| :--- | :--- | :--- |
| File write/read to whitelisted or workspace paths | Low | **PASS** (Normal behavior) |
| Registry reading of ZWCAD support settings | Low | **PASS** (Normal behavior) |
| File creation outside project/ZWCAD paths | High | **FAIL** (Investigate dropped payload) |
| Modification of system registry keys (Startup/Run) | Critical | **FAIL** (Block immediately, treat as malware) |
| Local socket binding or connection attempt | Critical | **FAIL** (Block immediately, security alert) |

---

## 6. Maintenance & Snapshots

* **Quarterly Update:** Power on the VM with host-only networking enabled to install ZWCAD service packs and Windows security updates, then immediately shut down and take a new clean snapshot.
* **Audit Trail:** Keep the comparison reports (`.txt` files from Regshot) and ProcMon event summaries (`.pml` files) stored in the project's security archive folder under `tests/security_logs/`.
