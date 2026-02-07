struct Point {
    int x;
    int y;
};

int test() {
    struct Point p;
    p.x = 10;
    return p.x;
}

int main() {
    return test();
}
