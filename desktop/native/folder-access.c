#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

static void fail(void) {
  fprintf(stderr, "Folder access denied or unavailable.\n");
  exit(1);
}

static int descend(int fd, char *path) {
  char *save, *segment = strtok_r(path, "/", &save);
  while (segment) {
    if (!strcmp(segment, "..")) fail();
    if (strcmp(segment, ".")) {
      int next = openat(fd, segment, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
      if (next < 0) fail();
      close(fd);
      fd = next;
    }
    segment = strtok_r(NULL, "/", &save);
  }
  return fd;
}

int main(int argc, char **argv) {
  if (argc != 6 || argv[1][0] != '/' || argv[4][0] == '/') fail();
  int fd = open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC);
  if (fd < 0) fail();
  fd = descend(fd, argv[1]);
  struct stat st;
  if (fstat(fd, &st)) fail();
  if ((unsigned long long)st.st_dev != strtoull(argv[2], NULL, 10) ||
      (unsigned long long)st.st_ino != strtoull(argv[3], NULL, 10)) fail();
  if (!strcmp(argv[5], "list")) {
    fd = descend(fd, argv[4]);
    DIR *dir = fdopendir(fd);
    if (!dir) fail();
    struct dirent *entry;
    int count = 0;
    while ((entry = readdir(dir)) && count < 201) {
      if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
      char type = entry->d_type == DT_DIR ? 'd' : entry->d_type == DT_REG ? 'f' : 'x';
      if (write(1, &type, 1) != 1) fail();
      size_t length = strlen(entry->d_name) + 1;
      if (write(1, entry->d_name, length) != (ssize_t)length) fail();
      count++;
    }
    closedir(dir);
    return 0;
  }
  if (strcmp(argv[5], "read")) fail();
  char *name = strrchr(argv[4], '/');
  if (name) {
    *name = 0;
    fd = descend(fd, argv[4]);
    name++;
  } else {
    name = argv[4];
  }
  if (!*name || !strcmp(name, ".") || !strcmp(name, "..")) fail();
  int file = openat(fd, name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  close(fd);
  if (file < 0 || fstat(file, &st) || !S_ISREG(st.st_mode) || st.st_size > 65536) fail();
  char buffer[65537];
  ssize_t total = 0, n;
  while (total < 65537 && (n = read(file, buffer + total, 65537 - total)) > 0) total += n;
  if (n < 0 || total > 65536) fail();
  close(file);
  if (write(1, buffer, total) != total) fail();
  return 0;
}
