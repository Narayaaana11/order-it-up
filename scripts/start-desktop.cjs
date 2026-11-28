const { spawn } = require('child_process');
const path = require('path');

// Clean ELECTRON_RUN_AS_NODE so Electron runs as a GUI application, not Node
delete process.env.ELECTRON_RUN_AS_NODE;

const electronExe = path.resolve(__dirname, '../node_modules/electron/dist/electron.exe');
console.log('[DesktopRunner] Launching Electron on winsta0\\default from:', electronExe);

const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Launcher {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public Int32 cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public Int32 dwX;
        public Int32 dwY;
        public Int32 dwXSize;
        public Int32 dwYSize;
        public Int32 dwXCountChars;
        public Int32 dwYCountChars;
        public Int32 dwFillAttribute;
        public Int32 dwFlags;
        public Int16 wShowWindow;
        public Int16 cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern UInt32 WaitForSingleObject(IntPtr hHandle, UInt32 dwMilliseconds);

    public static int Run(string appPath, string cmdLine, string workDir) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"winsta0\\default";

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        bool success = CreateProcess(appPath, cmdLine, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, workDir, ref si, out pi);
        if (!success) {
            Console.WriteLine("CreateProcess winsta0\\\\default failed: " + Marshal.GetLastWin32Error() + ", falling back to default...");
            si.lpDesktop = null;
            success = CreateProcess(appPath, cmdLine, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, workDir, ref si, out pi);
            if (!success) {
                Console.WriteLine("CreateProcess fallback failed: " + Marshal.GetLastWin32Error());
                return -1;
            }
        }
        Console.WriteLine("[DesktopLauncher] Electron running with PID: " + pi.dwProcessId);
        WaitForSingleObject(pi.hProcess, 0xFFFFFFFF); // Wait indefinitely until Electron closes
        return 0;
    }
}
"@;
[System.Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process');
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue;
$exe = "${electronExe.replace(/\\/g, '\\\\')}";
$cmd = "\`"$exe\`" \`".\`"";
$dir = "${path.resolve(__dirname, '..').replace(/\\/g, '\\\\')}";
[Launcher]::Run($exe, $cmd, $dir);
`;

const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined,
  },
});

child.on('exit', (code, signal) => {
  console.log(`[DesktopRunner] PowerShell launcher exited with code ${code}, signal ${signal}`);
  process.exit(code ?? (signal ? 1 : 0));
});
